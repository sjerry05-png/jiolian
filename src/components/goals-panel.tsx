"use client";

import { ArrowUpRight, PartyPopper, Plus, X } from "lucide-react";
import { useState } from "react";
import { addGoal, archiveGoal, rateGoal, setGoalAchieved } from "@/app/actions/fit";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { GOAL_MEANINGFUL, GOAL_RERATE_DAYS, GOAL_SUGGESTIONS, goalScoreLabel } from "@/lib/fitness";
import { plainDateLabel } from "@/lib/format";
import type { Goal, GoalRating } from "@/lib/types";

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);
}

/** 0～10 分的大按鈕（長輩好按） */
function ScorePicker({
  value,
  onPick,
  disabled,
  label,
}: {
  value: number | null;
  onPick: (n: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11" role="group" aria-label={label}>
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={value === n}
            aria-label={`${n} 分`}
            onClick={() => onPick(n)}
            className={`num h-12 rounded-xl border text-lg font-bold transition-colors ${
              value === n ? "border-track bg-track text-track-ink" : "border-line bg-surface text-ink hover:border-track"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-3">
        <span>0 做不到</span>
        <span>5 勉強可以</span>
        <span>10 很輕鬆</span>
      </div>
    </div>
  );
}

export function GoalsPanel({
  goals,
  ratings,
  userId,
  today,
  isSelf,
}: {
  goals: Goal[];
  ratings: GoalRating[];
  userId: string | null;
  today: string;
  isSelf: boolean;
}) {
  const active = goals.filter((g) => !g.archived_at && !g.achieved_at);
  const achieved = goals.filter((g) => !g.archived_at && g.achieved_at).sort((a, b) => b.achieved_at!.localeCompare(a.achieved_at!));
  const [adding, setAdding] = useState(active.length === 0 && achieved.length === 0);

  const byGoal = new Map<string, GoalRating[]>();
  for (const r of [...ratings].sort((a, b) => a.rated_on.localeCompare(b.rated_on))) {
    const list = byGoal.get(r.goal_id) ?? [];
    list.push(r);
    byGoal.set(r.goal_id, list);
  }

  return (
    <div className="space-y-3">
      {active.length > 0 ? (
        <ul className="space-y-3">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} ratings={byGoal.get(g.id) ?? []} today={today} isSelf={isSelf} />
          ))}
        </ul>
      ) : null}

      {achieved.length > 0 ? (
        <ul className="space-y-2">
          {achieved.map((g) => (
            <AchievedRow key={g.id} goal={g} />
          ))}
        </ul>
      ) : null}

      {adding ? (
        <AddGoalForm userId={userId} isSelf={isSelf} onDone={() => setAdding(false)} canCancel={active.length + achieved.length > 0} />
      ) : active.length < 5 ? (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          新增生活目標
        </Button>
      ) : (
        <p className="text-sm text-ink-3">進行中的目標最多 5 個，做到或收起一個再新增。</p>
      )}
    </div>
  );
}

function GoalCard({ goal, ratings, today, isSelf }: { goal: Goal; ratings: GoalRating[]; today: string; isSelf: boolean }) {
  const [rating, setRating] = useState(false);
  const act = useAction();
  const first = ratings[0];
  const last = ratings[ratings.length - 1];
  const due = last ? daysBetween(last.rated_on, today) >= GOAL_RERATE_DAYS : true;
  const delta = first && last && ratings.length > 1 ? last.score - first.score : null;

  return (
    <li className="rounded-2xl bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[1.0625rem] font-medium text-ink">{goal.title}</p>
        {due ? <span className="shrink-0 rounded-full bg-lane px-2 py-0.5 text-xs font-medium text-lane-ink">該重打分數了</span> : null}
      </div>

      {last ? (
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <p className="flex items-baseline gap-1">
            <span className="num text-4xl font-bold leading-none text-ink">{last.score}</span>
            <span className="text-ink-3">/10</span>
            <span className="ml-1.5 text-ink-2">{goalScoreLabel(last.score)}</span>
          </p>
          {delta != null ? (
            delta >= GOAL_MEANINGFUL ? (
              <p className="flex items-center gap-1 font-medium text-go">
                <ArrowUpRight className="size-5" aria-hidden />從 {first.score} 分到 {last.score} 分，有感進步
              </p>
            ) : (
              <p className="text-sm text-ink-2">
                從 {first.score} 分到 {last.score} 分{delta < 0 ? "，最近比較吃力" : ""}
              </p>
            )
          ) : (
            <p className="text-sm text-ink-3">起始分數（{plainDateLabel(first.rated_on)}）</p>
          )}
        </div>
      ) : null}

      {ratings.length > 1 ? (
        <div className="mt-3 flex h-12 items-end gap-1" aria-label={`分數紀錄：${ratings.map((r) => r.score).join("、")}`}>
          {ratings.slice(-12).map((r) => (
            <span key={r.rated_on} className="flex h-full flex-1 flex-col items-center justify-end" title={`${plainDateLabel(r.rated_on)}：${r.score} 分`}>
              <span className="w-full max-w-6 rounded-t bg-track/80" style={{ height: `${Math.max(6, r.score * 10)}%` }} />
            </span>
          ))}
        </div>
      ) : null}

      {rating ? (
        <div className="mt-3 rounded-xl bg-surface-2 p-3">
          <p className="mb-2 text-[0.9375rem] text-ink-2">現在做這件事，{isSelf ? "你" : "他"}覺得有多輕鬆？</p>
          <ScorePicker
            label={`「${goal.title}」的分數`}
            value={null}
            disabled={act.pending}
            onPick={(n) => act.run(() => rateGoal(goal.id, n), () => setRating(false))}
          />
        </div>
      ) : null}

      <ErrorText>{act.error}</ErrorText>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={due ? "primary" : "secondary"} onClick={() => setRating((v) => !v)}>
          {rating ? "先不要" : "重新打分數"}
        </Button>
        <Button size="sm" variant="lane" disabled={act.pending} onClick={() => act.run(() => setGoalAchieved(goal.id, true))}>
          <PartyPopper className="size-4" aria-hidden />
          做到了！
        </Button>
        <button
          type="button"
          disabled={act.pending}
          onClick={() => {
            if (window.confirm(`收起「${goal.title}」嗎？收起後不會再出現。`)) act.run(() => archiveGoal(goal.id));
          }}
          className="ml-auto text-sm text-ink-3 hover:text-ink"
        >
          收起來
        </button>
      </div>
    </li>
  );
}

function AchievedRow({ goal }: { goal: Goal }) {
  const act = useAction();
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-lane-soft px-4 py-3">
      <span className="text-2xl" aria-hidden>
        🎉
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">{goal.title}</span>
        <span className="block text-sm text-ink-2">
          {plainDateLabel(goal.achieved_at!.slice(0, 10))} 做到了{goal.share_with_group ? "・家人看得到" : ""}
        </span>
      </span>
      <button
        type="button"
        aria-label={`取消「${goal.title}」的做到了`}
        disabled={act.pending}
        onClick={() => act.run(() => setGoalAchieved(goal.id, false))}
        className="rounded p-1 text-ink-3 hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function AddGoalForm({
  userId,
  isSelf,
  onDone,
  canCancel,
}: {
  userId: string | null;
  isSelf: boolean;
  onDone: () => void;
  canCancel: boolean;
}) {
  const [title, setTitle] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [share, setShare] = useState(true);
  const { pending, error, run } = useAction();

  return (
    <form
      className="space-y-4 rounded-2xl bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (score == null) return;
        run(
          () => addGoal(userId, title, score, share),
          () => {
            setTitle("");
            setScore(null);
            onDone();
          },
        );
      }}
    >
      <div>
        <Label htmlFor={`goal-${userId ?? "me"}`} hint="1～40 個字">
          {isSelf ? "現在覺得吃力、想做得更順的事" : "他現在覺得吃力、想做得更順的事"}
        </Label>
        <Input
          id={`goal-${userId ?? "me"}`}
          value={title}
          maxLength={40}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：不扶扶手爬到 3 樓"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {GOAL_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTitle(s)}
              className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm text-ink-2 hover:border-track hover:text-track"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-ink-2">現在做這件事有多輕鬆？</p>
        <ScorePicker label="起始分數" value={score} onPick={setScore} />
      </div>
      <label className="flex items-center gap-2 text-[0.9375rem] text-ink">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="size-5 accent-[var(--track)]" />
        做到的時候，讓小團的家人看到、幫忙加油
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !title.trim() || score == null}>
          {pending ? "儲存中…" : "加入目標"}
        </Button>
        {canCancel ? (
          <Button variant="ghost" onClick={onDone}>
            取消
          </Button>
        ) : null}
      </div>
    </form>
  );
}
