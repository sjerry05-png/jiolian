import { money } from "@/lib/format";

/**
 * 價格階梯：第 n 階 = n 人上課時每人的價格。人越多，階梯越往下。
 * - 目前人數那一階填滿鈷藍
 * - 「再揪 1 人」那一階用號碼布黃標出來
 */
export function PriceStairs({
  ladder,
  headcount,
  showCoachTotal = false,
  compact = false,
}: {
  ladder: number[];
  headcount: number;
  showCoachTotal?: boolean;
  compact?: boolean;
}) {
  const max = Math.max(...ladder);
  const barMax = compact ? 64 : 132;
  const current = Math.min(Math.max(headcount, 0), ladder.length);
  const next = current < ladder.length ? current + 1 : null;

  return (
    <div
      className="flex items-end gap-1.5 sm:gap-2"
      role="img"
      aria-label={ladder.map((p, i) => `${i + 1} 人每人 ${p} 元`).join("，")}
    >
      {ladder.map((price, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const isNext = n === next;
        const isFilled = n <= current;
        const h = Math.max(14, Math.round((price / max) * barMax));
        return (
          <div key={n} className="flex min-w-0 flex-1 flex-col items-center">
            <span
              className={`num mb-1 whitespace-nowrap leading-none ${compact ? "text-[13px]" : "text-[15px] sm:text-lg"} ${
                isCurrent ? "font-bold text-track" : isNext ? "font-bold text-ink" : "text-ink-3"
              }`}
            >
              {money(price)}
            </span>
            <div
              className={`w-full rounded-t-md transition-[height,background-color] duration-300 ${
                isCurrent
                  ? "bg-track"
                  : isNext
                    ? "bg-lane"
                    : isFilled
                      ? "bg-track-soft"
                      : "bg-surface-2 ring-1 ring-inset ring-line"
              }`}
              style={{ height: h }}
            />
            <span
              className={`mt-1.5 whitespace-nowrap text-xs ${isCurrent ? "font-bold text-track" : isNext ? "font-bold text-ink" : "text-ink-3"}`}
            >
              {isNext && current >= 1 ? "再1人" : `${n}人`}
            </span>
            {showCoachTotal ? (
              <span className="num mt-0.5 whitespace-nowrap text-[11px] text-ink-3">{money(price * n)}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
