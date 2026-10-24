import { ENERGY_SCALE, SLEEP_SCALE } from "@/lib/fitness";
import { plainDateLabel } from "@/lib/format";
import type { Wellbeing } from "@/lib/types";

function painCell(p: number) {
  if (p === 0) return "bg-go-soft text-go";
  if (p <= 3) return "bg-track-soft text-track";
  if (p <= 6) return "bg-warn-soft text-warn";
  return "bg-stop-soft text-stop";
}

/** 最近 12 週的疼痛、睡眠、精神，一眼看出有沒有變舒服 */
export function WellbeingTrend({ weeks, emptyText }: { weeks: Wellbeing[]; emptyText: string }) {
  const sorted = [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(-12);
  if (sorted.length === 0) return <p className="text-sm text-ink-3">{emptyText}</p>;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const painDiff = last.pain - first.pain;
  const avg = (k: "sleep" | "energy", list: Wellbeing[]) => list.reduce((s, w) => s + w[k], 0) / list.length;
  const half = Math.max(1, Math.floor(sorted.length / 2));
  const sleepUp = sorted.length >= 4 && avg("sleep", sorted.slice(-half)) - avg("sleep", sorted.slice(0, half)) >= 0.75;
  const energyUp = sorted.length >= 4 && avg("energy", sorted.slice(-half)) - avg("energy", sorted.slice(0, half)) >= 0.75;
  const label = (w: Wellbeing) => plainDateLabel(w.week_start).replace(/（.）/, "");

  return (
    <div className="space-y-3">
      {sorted.length >= 2 ? (
        <ul className="space-y-1 text-[0.9375rem]">
          <li className="text-ink">
            疼痛：從 <span className="num font-bold">{first.pain}</span> 分到 <span className="num font-bold">{last.pain}</span> 分
            {painDiff <= -2 ? <span className="ml-1.5 font-medium text-go">變舒服了</span> : painDiff >= 2 ? <span className="ml-1.5 font-medium text-warn">痛變多，要注意</span> : null}
          </li>
          {sleepUp ? <li className="font-medium text-go">最近睡得比較好</li> : null}
          {energyUp ? <li className="font-medium text-go">最近精神比較好</li> : null}
        </ul>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-1 text-center text-sm">
          <thead>
            <tr>
              <th className="w-12 text-left font-normal text-ink-3">週</th>
              {sorted.map((w) => (
                <th key={w.week_start} className="num font-normal text-ink-3">
                  {label(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="text-left font-normal text-ink-2">疼痛</th>
              {sorted.map((w) => (
                <td key={w.week_start} className={`num h-9 min-w-9 rounded-lg font-bold ${painCell(w.pain)}`} title={w.pain_area ?? undefined}>
                  {w.pain}
                </td>
              ))}
            </tr>
            <tr>
              <th className="text-left font-normal text-ink-2">睡眠</th>
              {sorted.map((w) => (
                <td key={w.week_start} className="h-9 text-lg" title={SLEEP_SCALE[w.sleep - 1].label}>
                  {SLEEP_SCALE[w.sleep - 1].emoji}
                </td>
              ))}
            </tr>
            <tr>
              <th className="text-left font-normal text-ink-2">精神</th>
              {sorted.map((w) => (
                <td key={w.week_start} className="h-9 text-lg" title={ENERGY_SCALE[w.energy - 1].label}>
                  {ENERGY_SCALE[w.energy - 1].emoji}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {last.note ? <p className="text-sm text-ink-2">最近一週留言：「{last.note}」</p> : null}
    </div>
  );
}
