import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { DeleteAssessmentButton } from "@/components/fitness-bits";
import {
  ageFromBirthYear,
  compare,
  deltaLabel,
  formatValue,
  NORM_SOURCE,
  peerRank,
  type PeerRank,
  type TestDef,
  TESTS,
} from "@/lib/fitness";
import { plainDateLabel } from "@/lib/format";
import type { Assessment, BodyInfo } from "@/lib/types";

const TIER_STYLE: Record<PeerRank["tier"], string> = {
  top: "bg-go-soft text-go",
  good: "bg-go-soft text-go",
  average: "bg-track-soft text-track",
  low: "bg-warn-soft text-warn",
  weak: "bg-stop-soft text-stop",
};

/** 體能小考成績單：跟第一次比的變化、同齡排名、趨勢 */
export function FitnessReport({
  assessments,
  body,
  today,
  highlightId,
  names,
  canDelete,
}: {
  assessments: Assessment[];
  body: BodyInfo | null;
  today: string;
  highlightId?: string | null;
  names: Map<string, string>;
  canDelete: boolean;
}) {
  const sorted = [...assessments].sort((a, b) => a.measured_on.localeCompare(b.measured_on) || a.created_at.localeCompare(b.created_at));
  if (sorted.length === 0) return null;
  const age = ageFromBirthYear(body?.birth_year, today);
  const sex = body?.sex ?? null;
  const sexLabel = sex === "male" ? "男性" : sex === "female" ? "女性" : "";

  // 每一項：最早一次與最新一次有成績的紀錄
  const rows = TESTS.map((def) => {
    const points = sorted.filter((a) => a[def.key] != null).map((a) => ({ day: a.measured_on, value: Number(a[def.key]) }));
    if (points.length === 0) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const cmp = points.length >= 2 ? compare(def.key, first.value, last.value) : null;
    return { def, points, first, last, cmp, rank: peerRank(def.key, last.value, sex, age) };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const compared = rows.filter((r) => r.cmp);
  const better = compared.filter((r) => r.cmp!.change === "better");
  const worse = compared.filter((r) => r.cmp!.change === "worse");
  const firstDay = sorted[0].measured_on;
  const latest = sorted[sorted.length - 1];
  const justSaved = highlightId && latest.id === highlightId;

  return (
    <div className="space-y-4">
      {sorted.length === 1 ? (
        <div className="rounded-2xl bg-track-soft p-4">
          <p className="display text-lg text-ink">{justSaved ? "第一次小考存好了！" : "第一次小考"}（{plainDateLabel(firstDay)}）</p>
          <p className="mt-1 text-[0.9375rem] text-ink-2">這是起點。照著作業練 4～6 週後再測一次，就看得到進步。</p>
        </div>
      ) : (
        <div className={`rounded-2xl p-4 ${better.length > 0 ? "bg-go-soft" : "bg-track-soft"}`}>
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Sparkles className="size-4" aria-hidden />
            跟第一次（{plainDateLabel(firstDay)}）比，共 {sorted.length} 次小考
          </p>
          <p className="display mt-1 text-2xl text-ink">
            {better.length > 0 ? (
              <>
                有 <span className="num text-go">{better.length}</span> 項明顯進步
              </>
            ) : worse.length === 0 ? (
              "大致持平，繼續保持"
            ) : (
              "有幾項退步，跟教練聊聊"
            )}
          </p>
          {better.length > 0 ? (
            <p className="mt-1 text-[0.9375rem] text-ink-2">
              {better.map((r) => `${r.def.short}${deltaLabel(r.def.key, r.cmp!.delta)}`).join("、")}
            </p>
          ) : null}
        </div>
      )}

      {!sex || age == null ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
          {age != null && age < 55 ? "同齡排名從 55 歲開始。" : "填上出生年和性別，就能看到跟同齡的人比起來如何。"}
        </p>
      ) : age < 55 ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">同齡排名的資料從 55 歲開始，目前只看自己的進步。</p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.def.key} className="rounded-2xl bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-ink-3">{r.def.name}</p>
                <p className="font-medium text-ink">{r.def.short}</p>
              </div>
              <Spark def={r.def} points={r.points} />
            </div>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="num text-4xl font-bold leading-none text-ink">{formatValue(r.def.key, r.last.value)}</span>
              <span className="text-ink-2">{r.def.unit}</span>
            </p>
            {r.cmp ? <ChangeLine def={r.def} delta={r.cmp.delta} change={r.cmp.change} /> : null}
            {r.rank ? (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                <span className={`rounded-full px-2 py-0.5 font-medium ${TIER_STYLE[r.rank.tier]}`}>{r.rank.tierLabel}</span>
                <span className="text-ink-2">
                  贏過約 <span className="num font-bold text-ink">{r.rank.beats}%</span> 的 {r.rank.bandLabel} 歲{sexLabel}
                </span>
              </p>
            ) : null}
            {r.rank && r.rank.likeAgeBand !== r.rank.bandLabel ? (
              <p className="mt-1 text-sm text-ink-3">相當於 {r.rank.likeAgeBand} 歲的平均水準</p>
            ) : null}
            {r.def.warnBelow && sex && r.last.value < r.def.warnBelow[sex] ? (
              <p className="mt-2 rounded-lg bg-warn-soft px-2.5 py-1.5 text-sm text-warn">
                低於肌少症提醒值（{r.def.warnBelow[sex]} 公斤），要多練肌力
              </p>
            ) : null}
            <p className="mt-2 text-sm text-ink-2">👉 {r.def.life}</p>
          </li>
        ))}
      </ul>

      <details className="rounded-2xl bg-surface px-4 py-3">
        <summary className="cursor-pointer text-[0.9375rem] text-track">看每一次的紀錄（{sorted.length} 次）</summary>
        <ul className="mt-3 divide-y divide-line">
          {[...sorted].reverse().map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-ink">
                  {plainDateLabel(a.measured_on)}
                  <span className="ml-2 text-sm text-ink-3">
                    {a.recorded_by && a.recorded_by !== a.user_id ? `${names.get(a.recorded_by) ?? "教練"}記錄` : "自己測"}
                    {a.bp_sys ? `・血壓 ${a.bp_sys}/${a.bp_dia}` : ""}
                    {a.hr_rest ? `・心跳 ${a.hr_rest}` : ""}
                    {a.doctor_ok ? "・已取得醫生同意" : ""}
                  </span>
                </p>
                {canDelete ? <DeleteAssessmentButton id={a.id} label={plainDateLabel(a.measured_on)} /> : null}
              </div>
              <p className="mt-1 text-sm text-ink-2">
                {TESTS.filter((t) => a[t.key] != null)
                  .map((t) => `${t.short} ${formatValue(t.key, a[t.key] as number)}${t.unit}`)
                  .join("・")}
              </p>
              {a.note ? <p className="mt-0.5 text-sm text-ink-3">「{a.note}」</p> : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-line pt-2 text-xs leading-relaxed text-ink-3">
          同齡排名依 {NORM_SOURCE}。「明顯進步」門檻：椅子坐立 2 次、握力 5 公斤（研究數字）；手臂屈舉 2 次、抬膝 10 次、柔軟度 3
          公分、起身繞物 0.5 秒、單足立 5 秒（實務參考值）。小於門檻的變化可能只是當天狀況，算「持平」。
        </p>
      </details>
    </div>
  );
}

function ChangeLine({ def, delta, change }: { def: TestDef; delta: number; change: "better" | "worse" | "same" }) {
  if (change === "better") {
    return (
      <p className="mt-1.5 flex items-center gap-1 font-medium text-go">
        <ArrowUpRight className="size-5" aria-hidden />
        {deltaLabel(def.key, delta)}・明顯進步
      </p>
    );
  }
  if (change === "worse") {
    return (
      <p className="mt-1.5 flex items-center gap-1 font-medium text-warn">
        <ArrowDownRight className="size-5" aria-hidden />
        {deltaLabel(def.key, delta)}・退步了
      </p>
    );
  }
  return (
    <p className="mt-1.5 flex items-center gap-1 text-ink-2">
      <ArrowRight className="size-5" aria-hidden />
      {Math.abs(delta) < 1e-9 ? "跟第一次一樣" : deltaLabel(def.key, delta)}・持平
    </p>
  );
}

/** 迷你趨勢線：往上 = 變好（秒數項目已反轉） */
function Spark({ def, points }: { def: TestDef; points: { day: string; value: number }[] }) {
  if (points.length < 2) return null;
  const W = 84;
  const H = 30;
  const vals = points.map((p) => (def.better === "lower" ? -p.value : p.value));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const xy = vals.map((v, i) => [2 + (i / (vals.length - 1)) * (W - 4), H - 3 - ((v - lo) / span) * (H - 6)] as const);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke="var(--track)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3} fill="var(--track)" />
    </svg>
  );
}
