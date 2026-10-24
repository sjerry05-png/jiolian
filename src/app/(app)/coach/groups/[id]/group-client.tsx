"use client";

import { Archive, Copy, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import {
  archiveHabit,
  createHabit,
  createSessions,
  leaveGroup,
  regenerateInvite,
  setGroupArchived,
  updateHabit,
} from "@/app/actions/fit";
import { Button, ErrorText, Input, Label, Select } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { isoToTaipeiLocal, LOCATION_LABEL, taipeiLocalToIso } from "@/lib/format";
import type { Group, Habit, LocationType } from "@/lib/types";

// ── 邀請連結 ──
export function InvitePanel({ group, url }: { group: Group; url: string }) {
  const [copied, setCopied] = useState(false);
  const { pending, error, run } = useAction();
  const message = `${group.name}｜一起來揪練！點連結加入，人越多每人越便宜：${url}`;

  return (
    <div className="rounded-2xl bg-track p-4 text-track-ink sm:p-5">
      <p className="font-medium">邀請學員加入</p>
      <p className="mt-0.5 text-sm opacity-85">把連結傳到家人或朋友的 LINE 群組，點開就能加入。</p>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/12 px-3 py-2.5">
        <span className="num min-w-0 flex-1 truncate text-[0.9375rem]">{url}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              window.prompt("複製這段文字：", message);
            }
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-[0.9375rem] font-medium text-track"
        >
          <Copy className="size-4" />
          {copied ? "已複製" : "複製邀請文字"}
        </button>
        <a
          href={`https://line.me/R/share?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-xl bg-[#06c755] px-4 text-[0.9375rem] font-medium text-white"
        >
          用 LINE 傳送
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("換新連結後，舊連結就不能用了（已加入的人不受影響）。確定嗎？")) run(() => regenerateInvite(group.id));
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-track-ink/85 hover:bg-white/10"
        >
          <RefreshCw className="size-4" />
          換新連結
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-lane">{error}</p> : null}
    </div>
  );
}

// ── 排課 ──
function defaultStart(): string {
  // 預設：下一個整點後 2 天的早上 9 點
  const d = new Date(Date.now() + 2 * 86400_000);
  const local = isoToTaipeiLocal(d.toISOString());
  return `${local.slice(0, 10)}T09:00`;
}

export function NewSessionForm({ group }: { group: Group }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(defaultStart);
  const [duration, setDuration] = useState(group.default_duration_min);
  const [locationType, setLocationType] = useState<LocationType>(group.default_location_type);
  const [location, setLocation] = useState(group.default_location ?? "");
  const [title, setTitle] = useState("");
  const [repeat, setRepeat] = useState(1);
  const [enrollAll, setEnrollAll] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const { pending, error, run } = useAction();

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={() => setOpen(true)}>排一堂課</Button>
        {done ? <span className="text-sm text-go">已排好 {done} 堂課</span> : null}
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl bg-surface p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            createSessions(group.id, {
              startsAt: taipeiLocalToIso(start),
              durationMin: duration,
              locationType,
              location,
              title,
              repeatWeeks: repeat,
              enrollAll,
            }),
          (ids) => {
            setDone(ids.length);
            setOpen(false);
          },
        );
      }}
    >
      <p className="display text-xl text-ink">排課</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="s-start">上課時間</Label>
          <Input id="s-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="s-dur">多久</Label>
          <Select id="s-dur" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} 分鐘
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="s-lt">地點類型</Label>
          <Select id="s-lt" value={locationType} onChange={(e) => setLocationType(e.target.value as LocationType)}>
            {(["home", "gym", "outdoor", "online"] as LocationType[]).map((l) => (
              <option key={l} value={l}>
                {LOCATION_LABEL[l]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="s-loc" hint="選填">
            地點說明
          </Label>
          <Input id="s-loc" value={location} maxLength={100} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-title" hint="選填">
            這堂主題
          </Label>
          <Input id="s-title" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="例如：核心訓練" />
        </div>
        <div>
          <Label htmlFor="s-rep">每週同一時間，連排幾週</Label>
          <Select id="s-rep" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "只排這一堂" : `連排 ${n} 週`}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-[0.9375rem] text-ink">
        <input type="checkbox" checked={enrollAll} onChange={(e) => setEnrollAll(e.target.checked)} className="mt-1 size-4 accent-[var(--track)]" />
        <span>
          幫全團先報名
          <span className="block text-sm text-ink-3">適合固定班。不能來的人要在取消期限前自己按「不來」，否則照樣計費。</span>
        </span>
      </label>
      <p className="text-sm text-ink-3">取消期限：上課前 {group.lock_hours} 小時。價格用這個小團目前的價目表。</p>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "排課中…" : repeat > 1 ? `排 ${repeat} 堂課` : "排這堂課"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          取消
        </Button>
      </div>
    </form>
  );
}

// ── 作業 ──
export function HabitForm({ groupId, members }: { groupId: string; members: { id: string; name: string }[] }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [days, setDays] = useState(3);
  const [memberId, setMemberId] = useState("");
  const { pending, error, run } = useAction();

  return (
    <form
      className="space-y-4 rounded-2xl bg-surface p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createHabit(groupId, title, days, detail, memberId || null),
          () => {
            setTitle("");
            setDetail("");
          },
        );
      }}
    >
      <p className="display text-xl text-ink">出一項每週作業</p>
      <div>
        <Label htmlFor="h-title">作業內容</Label>
        <Input id="h-title" value={title} maxLength={40} required onChange={(e) => setTitle(e.target.value)} placeholder="例如：深蹲 3 組 × 15 下" />
      </div>
      <div>
        <Label htmlFor="h-detail" hint="選填">
          怎麼做
        </Label>
        <Input id="h-detail" value={detail} maxLength={300} onChange={(e) => setDetail(e.target.value)} placeholder="例如：膝蓋不要超過腳尖，組間休息 60 秒" />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-2">每週做幾次</legend>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={days === n}
              onClick={() => setDays(n)}
              className={`num size-11 rounded-xl text-lg font-bold ${days === n ? "bg-track text-track-ink" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-sm text-ink-3">{days === 7 ? "每天都要做" : `一週 ${days} 次，哪幾天做由學員決定`}</p>
      </fieldset>
      <div>
        <Label htmlFor="h-member">給誰</Label>
        <Select id="h-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">全團都要做</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              只給 {m.name}
            </option>
          ))}
        </Select>
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={pending || !title.trim()}>
        {pending ? "新增中…" : "新增作業"}
      </Button>
    </form>
  );
}

export function HabitItem({ habit, memberName }: { habit: Habit; memberName: string | null }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(habit.title);
  const [detail, setDetail] = useState(habit.detail ?? "");
  const [days, setDays] = useState(habit.days_per_week);
  const { pending, error, run } = useAction();

  if (editing) {
    return (
      <li className="space-y-3 px-4 py-4">
        <Input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} aria-label="作業內容" />
        <Input value={detail} maxLength={300} onChange={(e) => setDetail(e.target.value)} aria-label="怎麼做" placeholder="怎麼做（選填）" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-2">每週</span>
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24" aria-label="每週次數">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} 次
              </option>
            ))}
          </Select>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => updateHabit(habit.id, title, days, detail), () => setEditing(false))}>
            儲存
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            取消
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <span className="num mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-track-soft font-bold text-track" title="每週次數">
        {habit.days_per_week}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{habit.title}</p>
        <p className="text-sm text-ink-3">
          每週 {habit.days_per_week} 次・{memberName ? `只給 ${memberName}` : "全團"}
          {habit.detail ? `・${habit.detail}` : ""}
        </p>
        {error ? <p className="text-sm text-stop">{error}</p> : null}
      </div>
      <button type="button" aria-label="修改" onClick={() => setEditing(true)} className="rounded-lg p-2 text-ink-3 hover:bg-track-soft hover:text-track">
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        aria-label="結束這項作業"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`結束「${habit.title}」？學員之後不會再看到，但打卡紀錄會保留。`)) run(() => archiveHabit(habit.id));
        }}
        className="rounded-lg p-2 text-ink-3 hover:bg-stop-soft hover:text-stop"
      >
        <Archive className="size-4" />
      </button>
    </li>
  );
}

// ── 設定：封存、移除成員 ──
export function ArchiveGroupButton({ group }: { group: Group }) {
  const { pending, error, run } = useAction();
  const archived = !!group.archived_at;
  return (
    <div>
      <Button
        variant={archived ? "secondary" : "danger"}
        disabled={pending}
        onClick={() => {
          if (archived || window.confirm("封存後不能再排課，邀請連結也會失效。之後可以再恢復。確定嗎？"))
            run(() => setGroupArchived(group.id, !archived));
        }}
      >
        {archived ? "恢復這個小團" : "封存這個小團"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function RemoveMemberButton({ groupId, userId, name }: { groupId: string; userId: string; name: string }) {
  const { pending, error, run } = useAction();
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`把 ${name} 移出小團？還沒過取消期限的報名會自動取消。`)) run(() => leaveGroup(groupId, userId));
        }}
        className="text-sm text-ink-3 hover:text-stop"
      >
        移出小團
      </button>
      {error ? <span className="ml-2 text-sm text-stop">{error}</span> : null}
    </span>
  );
}
