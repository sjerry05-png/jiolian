"use client";

import { useState } from "react";
import { saveWellbeing } from "@/app/actions/fit";
import { Button, ErrorText, Input } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { ENERGY_SCALE, PAIN_AREAS, painLabel, SLEEP_SCALE } from "@/lib/fitness";
import type { Wellbeing } from "@/lib/types";

function painColor(p: number) {
  if (p === 0) return "border-go bg-go text-white";
  if (p <= 3) return "border-track bg-track text-track-ink";
  if (p <= 6) return "border-warn bg-warn text-white";
  return "border-stop bg-stop text-white";
}

function FaceScale({
  scale,
  value,
  onPick,
  label,
}: {
  scale: readonly { value: number; emoji: string; label: string }[];
  value: number | null;
  onPick: (v: number) => void;
  label: string;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={label}>
      {scale.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-pressed={value === s.value}
          onClick={() => onPick(s.value)}
          className={`flex flex-col items-center rounded-xl border px-1 py-2 transition-colors ${
            value === s.value ? "border-track bg-track-soft" : "border-line bg-surface hover:border-track"
          }`}
        >
          <span className="text-2xl" aria-hidden>
            {s.emoji}
          </span>
          <span className={`mt-0.5 text-xs ${value === s.value ? "font-medium text-track" : "text-ink-2"}`}>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

/** 這週身體感受：疼痛 0～10（哪裡痛）、睡眠、精神 */
export function WellbeingCard({ current }: { current: Wellbeing | null }) {
  const [editing, setEditing] = useState(current == null);
  const [pain, setPain] = useState<number | null>(current?.pain ?? null);
  const [area, setArea] = useState(current?.pain_area ?? "");
  const [sleep, setSleep] = useState<number | null>(current?.sleep ?? null);
  const [energy, setEnergy] = useState<number | null>(current?.energy ?? null);
  const [note, setNote] = useState(current?.note ?? "");
  const { pending, error, run } = useAction();

  if (!editing && current) {
    const s = SLEEP_SCALE.find((x) => x.value === current.sleep)!;
    const e = ENERGY_SCALE.find((x) => x.value === current.energy)!;
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-surface p-4">
        <p className="text-ink">
          <span className="text-sm text-ink-3">疼痛</span>{" "}
          <span className="num text-2xl font-bold">{current.pain}</span>
          <span className="ml-1 text-sm text-ink-2">
            {painLabel(current.pain)}
            {current.pain_area ? `・${current.pain_area}` : ""}
          </span>
        </p>
        <p className="text-ink">
          <span className="text-sm text-ink-3">睡眠</span> {s.emoji} <span className="text-sm text-ink-2">{s.label}</span>
        </p>
        <p className="text-ink">
          <span className="text-sm text-ink-3">精神</span> {e.emoji} <span className="text-sm text-ink-2">{e.label}</span>
        </p>
        <button type="button" onClick={() => setEditing(true)} className="ml-auto text-sm text-track hover:underline">
          修改
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5 rounded-2xl bg-surface p-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (pain == null || sleep == null || energy == null) return;
        run(() => saveWellbeing(pain, sleep, energy, pain > 0 ? area : "", note), () => setEditing(false));
      }}
    >
      <div>
        <p className="mb-2 font-medium text-ink">
          這週身體哪裡痛嗎？
          {pain != null ? <span className="ml-2 text-sm font-normal text-ink-2">{painLabel(pain)}</span> : null}
        </p>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11" role="group" aria-label="疼痛分數">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              aria-pressed={pain === n}
              aria-label={`疼痛 ${n} 分`}
              onClick={() => setPain(n)}
              className={`num h-12 rounded-xl border text-lg font-bold ${pain === n ? painColor(n) : "border-line bg-surface text-ink hover:border-track"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-3">
          <span>0 不痛</span>
          <span>10 痛到受不了</span>
        </div>
        {pain != null && pain > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-ink-2">哪裡：</span>
            {PAIN_AREAS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={area === a}
                onClick={() => setArea(area === a ? "" : a)}
                className={`rounded-full border px-3 py-1 text-sm ${area === a ? "border-track bg-track text-track-ink" : "border-line bg-surface-2 text-ink-2"}`}
              >
                {a}
              </button>
            ))}
            <Input
              aria-label="其他部位"
              className="h-9 w-28 text-sm"
              value={PAIN_AREAS.includes(area) ? "" : area}
              maxLength={20}
              onChange={(e) => setArea(e.target.value)}
              placeholder="其他"
            />
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-2 font-medium text-ink">這週睡得好嗎？</p>
        <FaceScale scale={SLEEP_SCALE} value={sleep} onPick={setSleep} label="睡眠" />
      </div>

      <div>
        <p className="mb-2 font-medium text-ink">這週精神、體力如何？</p>
        <FaceScale scale={ENERGY_SCALE} value={energy} onPick={setEnergy} label="精神" />
      </div>

      <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="想跟教練說的話（選填）" aria-label="想跟教練說的話" />

      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || pain == null || sleep == null || energy == null}>
          {pending ? "儲存中…" : "送出這週感受"}
        </Button>
        {current ? (
          <Button variant="ghost" onClick={() => setEditing(false)}>
            取消
          </Button>
        ) : null}
      </div>
    </form>
  );
}
