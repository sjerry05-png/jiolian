import { plainDateLabel } from "@/lib/format";

/**
 * 打卡日曆：每欄一週（週一在上），顏色深淺 = 當天打卡次數（單一色相，淺 → 深）。
 * days: { day: 'YYYY-MM-DD', count }[]；today: 台灣今天
 */
export function CheckinCalendar({
  counts,
  today,
  weeks = 10,
}: {
  counts: Map<string, number>;
  today: string;
  weeks?: number;
}) {
  const [y, m, d] = today.split("-").map(Number);
  const todayUtc = Date.UTC(y, m - 1, d);
  const todayDow = (new Date(todayUtc).getUTCDay() + 6) % 7; // 0 = 週一
  const start = todayUtc - (todayDow + (weeks - 1) * 7) * 86400_000;
  const max = Math.max(1, ...counts.values());

  const columns: { day: string; count: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const t = start + (w * 7 + i) * 86400_000;
      const day = new Date(t).toISOString().slice(0, 10);
      col.push({ day, count: counts.get(day) ?? 0, future: t > todayUtc });
    }
    columns.push(col);
  }

  const level = (c: number) => (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));
  const LEVEL_CLASS = ["bg-surface-2 ring-1 ring-inset ring-line", "bg-track/25", "bg-track/50", "bg-track/75", "bg-track"];
  const activeDays = Array.from(counts.entries()).filter(([day, c]) => c > 0 && Date.parse(day) >= start).length;

  return (
    <figure>
      <div className="flex gap-1.5">
        <div className="flex flex-col gap-1.5 pr-1 text-[0.625rem] leading-[0.875rem] text-ink-3" aria-hidden>
          {["一", "", "三", "", "五", "", "日"].map((l, i) => (
            <span key={i} className="h-[0.875rem] sm:h-[1.125rem] sm:leading-[1.125rem]">
              {l}
            </span>
          ))}
        </div>
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-1 flex-col gap-1.5">
            {col.map((cell) => (
              <span
                key={cell.day}
                title={cell.future ? undefined : `${plainDateLabel(cell.day)}：${cell.count > 0 ? `打卡 ${cell.count} 次` : "沒打卡"}`}
                className={`block h-[0.875rem] rounded-[3px] sm:h-[1.125rem] ${cell.future ? "opacity-0" : LEVEL_CLASS[level(cell.count)]} ${
                  cell.day === today ? "outline-2 outline-offset-1 outline-lane" : ""
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex items-center justify-between text-xs text-ink-3">
        <span>
          近 {weeks} 週有 <span className="num font-bold text-ink">{activeDays}</span> 天打卡
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          少
          {LEVEL_CLASS.map((c, i) => (
            <span key={i} className={`inline-block size-3 rounded-[3px] ${c}`} />
          ))}
          多
        </span>
      </figcaption>
    </figure>
  );
}
