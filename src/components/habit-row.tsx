"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { checkin, undoCheckin } from "@/app/actions/fit";
import { useAction } from "@/components/use-action";
import { FEELINGS } from "@/lib/format";
import type { TodayHabit } from "@/lib/types";

export function WeekDots({ done, target }: { done: number; target: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`本週 ${done}/${target} 次`}>
      {Array.from({ length: target }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`inline-block size-2 rounded-full ${i < done ? "bg-track" : "bg-transparent ring-1 ring-inset ring-ink-3/50"}`}
        />
      ))}
      {done > target ? <span className="num ml-0.5 text-xs text-track">+{done - target}</span> : null}
    </span>
  );
}

export function HabitRow({ habit, showGroup, canBackfill }: { habit: TodayHabit; showGroup: boolean; canBackfill: boolean }) {
  const { pending, error, run } = useAction();
  // 樂觀更新：按下去馬上蓋章，伺服器回來再以伺服器為準
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const [justDone, setJustDone] = useState(false);
  const done = optimisticDone ?? habit.done_today;

  const toggle = () => {
    if (done) {
      setOptimisticDone(false);
      run(
        () => undoCheckin(habit.habit_id, null),
        () => setOptimisticDone(null),
      );
    } else {
      setOptimisticDone(true);
      setJustDone(true);
      run(
        () => checkin(habit.habit_id, null, null, null),
        () => setOptimisticDone(null),
      );
    }
  };

  const setFeeling = (v: number) => run(() => checkin(habit.habit_id, null, v, null));
  const backfill = () => run(() => checkin(habit.habit_id, yesterdayISO(), null, null));

  const weekDone = habit.week_done + (optimisticDone === true && !habit.done_today ? 1 : 0) - (optimisticDone === false && habit.done_today ? 1 : 0);

  return (
    <li className="flex gap-3.5 py-4">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={done}
        aria-label={done ? `取消「${habit.title}」今天的打卡` : `「${habit.title}」打卡`}
        className={`flex size-14 shrink-0 items-center justify-center rounded-full border-[3px] transition-colors ${
          done ? "border-track bg-track text-track-ink" : "border-track/40 bg-surface text-track/40 hover:border-track hover:text-track"
        }`}
      >
        <Check className={`size-7 ${done && justDone ? "stamp-in" : ""}`} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className={`text-[1.0625rem] font-medium ${done ? "text-ink" : "text-ink"}`}>{habit.title}</p>
          {habit.is_personal ? <span className="text-xs text-track">只給你</span> : null}
        </div>
        {habit.detail ? <p className="mt-0.5 text-sm text-ink-2">{habit.detail}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <WeekDots done={weekDone} target={habit.days_per_week} />
          <span>
            本週 {weekDone}/{habit.days_per_week} 次
          </span>
          {showGroup ? <span>{habit.group_name}</span> : null}
          {canBackfill && !habit.done_yesterday && !done ? (
            <button type="button" onClick={backfill} disabled={pending} className="text-track underline-offset-2 hover:underline">
              補打昨天
            </button>
          ) : null}
        </div>

        {done ? (
          <div className="mt-2.5 flex items-center gap-1" role="group" aria-label="今天練完感覺如何">
            {FEELINGS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFeeling(f.value)}
                disabled={pending}
                aria-pressed={habit.today_feeling === f.value}
                title={f.label}
                className={`flex size-9 items-center justify-center rounded-full text-lg transition ${
                  habit.today_feeling === f.value ? "bg-lane ring-2 ring-lane" : "opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                }`}
              >
                <span aria-hidden>{f.emoji}</span>
                <span className="sr-only">{f.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {habit.coach_reaction || habit.coach_comment ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-track-soft px-2.5 py-1 text-sm text-ink">
            <span aria-hidden>{habit.coach_reaction}</span>
            <span className="text-ink-2">教練：</span>
            {habit.coach_comment ?? "給你按讚"}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-stop">{error}</p> : null}
      </div>
    </li>
  );
}

function yesterdayISO(): string {
  const now = new Date(Date.now() + 8 * 3600_000 - 86400_000); // 台灣時間的昨天
  return now.toISOString().slice(0, 10);
}
