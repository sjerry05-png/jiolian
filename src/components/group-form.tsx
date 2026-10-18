"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { createGroup, updateGroup, type GroupInput } from "@/app/actions/fit";
import { PriceStairs } from "@/components/price-stairs";
import { Button, ErrorText, Input, Label, Select, Textarea } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { LOCATION_LABEL, money, suggestLadder } from "@/lib/format";
import type { Group, LocationType } from "@/lib/types";

const LOCATIONS: LocationType[] = ["home", "gym", "outdoor", "online"];

export function GroupForm({ group }: { group?: Group }) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [locationType, setLocationType] = useState<LocationType>(group?.default_location_type ?? "home");
  const [location, setLocation] = useState(group?.default_location ?? "");
  const [durationMin, setDurationMin] = useState(group?.default_duration_min ?? 60);
  const [lockHours, setLockHours] = useState(group?.lock_hours ?? 12);
  const [ladder, setLadder] = useState<number[]>(group?.price_ladder ?? suggestLadder(1500, 6));
  const [solo, setSolo] = useState(String(group?.price_ladder[0] ?? 1500));
  const [preview, setPreview] = useState(Math.min(3, ladder.length));
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const { pending, error, run } = useAction();

  const ladderProblem = ladder.some((p) => !Number.isFinite(p) || p < 1)
    ? "每一格都要填 1 元以上"
    : ladder.some((p, i) => i > 0 && p > ladder[i - 1])
      ? "人越多，每人價格不能比少一人時還貴"
      : null;
  const revenueDrops = ladder.findIndex((p, i) => i > 0 && p * (i + 1) < ladder[i - 1] * i);

  const setSize = (n: number) => {
    const size = Math.min(12, Math.max(1, n));
    setLadder((cur) => {
      if (size <= cur.length) return cur.slice(0, size);
      const extra = suggestLadder(cur[0], size).slice(cur.length).map((p) => Math.min(p, cur[cur.length - 1]));
      return [...cur, ...extra];
    });
    setPreview((p) => Math.min(p, size));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ladderProblem) return;
    const input: GroupInput = { name, description, locationType, location, durationMin, lockHours, ladder };
    setSavedNote(null);
    if (group) {
      run(
        () => updateGroup(group.id, input),
        (n) => setSavedNote(n > 0 ? `已儲存，並更新了 ${n} 堂還沒鎖定的課的價格` : "已儲存"),
      );
    } else {
      run(() => createGroup(input));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="g-name">小團名稱</Label>
          <Input
            id="g-name"
            value={name}
            maxLength={40}
            required
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：林家週六晨練團"
          />
        </div>
        <div>
          <Label htmlFor="g-desc" hint="選填，學員打開邀請連結時會看到">
            介紹
          </Label>
          <Textarea
            id="g-desc"
            value={description}
            maxLength={300}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：每週六早上 9 點在家練核心與肌力，適合完全沒運動習慣的人。"
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-2">通常在哪裡上課</legend>
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={locationType === l}
              onClick={() => setLocationType(l)}
              className={`rounded-full px-4 py-2 text-[15px] ${
                locationType === l ? "bg-track text-track-ink" : "bg-surface text-ink-2 ring-1 ring-line hover:ring-track"
              }`}
            >
              {LOCATION_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Label htmlFor="g-loc" hint="選填，每堂課可以再改">
            地點說明
          </Label>
          <Input
            id="g-loc"
            value={location}
            maxLength={100}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={locationType === "home" ? "例如：林家客廳（中和）" : locationType === "gym" ? "例如：XX 健身房永和店" : "例如：大安森林公園"}
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="g-dur">每堂多久</Label>
          <Select id="g-dur" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} 分鐘
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="g-lock">免費取消期限</Label>
          <Select id="g-lock" value={lockHours} onChange={(e) => setLockHours(Number(e.target.value))}>
            {[0, 2, 6, 12, 24, 48].map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "開課前都能取消" : `上課前 ${h} 小時`}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <section className="rounded-2xl bg-surface p-4 sm:p-5">
        <h2 className="display text-xl text-ink">價目表</h2>
        <p className="mt-1 text-sm text-ink-2">
          每一格是「這麼多人一起上時，每人付多少」。人越多每人越便宜，你這堂收得越多。
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-36">
            <Label htmlFor="g-solo">一對一價格</Label>
            <Input id="g-solo" inputMode="numeric" value={solo} onChange={(e) => setSolo(e.target.value.replace(/\D/g, ""))} />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              const s = Number(solo);
              if (s > 0) setLadder(suggestLadder(s, ladder.length));
            }}
          >
            依一對一價格自動算
          </Button>
          <div className="ml-auto">
            <span className="mb-1.5 block text-sm font-medium text-ink-2">最多幾人</span>
            <div className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5 ring-1 ring-line">
              <button type="button" aria-label="減少人數上限" onClick={() => setSize(ladder.length - 1)} className="flex size-9 items-center justify-center rounded-full disabled:opacity-30" disabled={ladder.length <= 1}>
                <Minus className="size-4" />
              </button>
              <output className="num w-7 text-center text-lg font-bold">{ladder.length}</output>
              <button type="button" aria-label="增加人數上限" onClick={() => setSize(ladder.length + 1)} className="flex size-9 items-center justify-center rounded-full disabled:opacity-30" disabled={ladder.length >= 12}>
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <PriceStairs ladder={ladder.map((p) => (Number.isFinite(p) && p > 0 ? p : 1))} headcount={preview} showCoachTotal />
          <p className="mt-2 text-center text-xs text-ink-3">每欄最下面的數字是你這堂的總收入</p>
        </div>

        <table className="mt-5 w-full text-[15px]">
          <thead>
            <tr className="text-left text-sm text-ink-3">
              <th className="pb-2 font-normal">人數</th>
              <th className="pb-2 font-normal">每人付</th>
              <th className="pb-2 text-right font-normal">你這堂收</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((p, i) => (
              <tr key={i} className="border-t border-line" onFocus={() => setPreview(i + 1)}>
                <td className="py-1.5 text-ink-2">{i + 1} 人</td>
                <td className="py-1.5">
                  <label className="sr-only" htmlFor={`price-${i}`}>
                    {i + 1} 人時每人價格
                  </label>
                  <input
                    id={`price-${i}`}
                    inputMode="numeric"
                    value={Number.isFinite(p) ? String(p) : ""}
                    onChange={(e) => {
                      const v = Number(e.target.value.replace(/\D/g, ""));
                      setLadder((cur) => cur.map((x, j) => (j === i ? v : x)));
                    }}
                    className="num h-10 w-28 rounded-lg border border-line bg-surface-2 px-2.5 text-[16px] focus:border-track focus:outline-none"
                  />
                </td>
                <td className="num py-1.5 text-right text-ink">{money((Number.isFinite(p) ? p : 0) * (i + 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ladderProblem ? <p className="mt-2 text-sm text-stop">{ladderProblem}</p> : null}
        {!ladderProblem && revenueDrops > 0 ? (
          <p className="mt-2 text-sm text-warn">
            注意：{revenueDrops + 1} 人時你的總收入比 {revenueDrops} 人時還少，建議調高一點。
          </p>
        ) : null}
      </section>

      <ErrorText>{error}</ErrorText>
      {savedNote && !pending ? <p className="text-sm text-go">{savedNote}</p> : null}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending || !name.trim() || !!ladderProblem}>
        {pending ? "儲存中…" : group ? "儲存變更" : "建立小團，拿邀請連結"}
      </Button>
    </form>
  );
}
