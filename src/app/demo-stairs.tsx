"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { PriceStairs } from "@/components/price-stairs";
import { money } from "@/lib/format";

const LADDER = [1500, 975, 750, 630, 555, 495];

export function DemoStairs() {
  const [n, setN] = useState(3);
  const price = LADDER[n - 1];
  const total = price * n;
  const uplift = Math.round((total / LADDER[0] - 1) * 100);

  return (
    <div className="rounded-3xl bg-surface p-5 shadow-[0_1px_0_var(--line)] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-2">週六早上・林家客廳</p>
          <p className="display text-xl text-ink">這堂有幾個人？</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line">
          <button
            type="button"
            aria-label="少一人"
            onClick={() => setN((v) => Math.max(1, v - 1))}
            disabled={n === 1}
            className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-track-soft disabled:opacity-30"
          >
            <Minus className="size-5" />
          </button>
          <output aria-live="polite" className="num w-10 text-center text-2xl font-bold text-ink">
            {n}
          </output>
          <button
            type="button"
            aria-label="多一人"
            onClick={() => setN((v) => Math.min(LADDER.length, v + 1))}
            disabled={n === LADDER.length}
            className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-track-soft disabled:opacity-30"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <PriceStairs ladder={LADDER} headcount={n} showCoachTotal />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-track-soft px-4 py-3">
          <dt className="text-sm text-ink-2">學員每人付</dt>
          <dd className="num text-3xl font-bold text-track">{money(price)}</dd>
          <dd className="text-xs text-ink-2">{n > 1 ? `比自己上省 ${money(LADDER[0] - price)}` : "自己上課"}</dd>
        </div>
        <div className="rounded-2xl bg-lane-soft px-4 py-3">
          <dt className="text-sm text-ink-2">教練這堂收</dt>
          <dd className="num text-3xl font-bold text-ink">{money(total)}</dd>
          <dd className="text-xs text-ink-2">{n > 1 ? `比一對一多 ${uplift}%` : "一對一"}</dd>
        </div>
      </dl>
    </div>
  );
}
