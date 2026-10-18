"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { addMetric, deleteMetric } from "@/app/actions/fit";
import { MetricChart } from "@/components/metric-chart";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { plainDateLabel, todayInTaipei } from "@/lib/format";
import type { Metric } from "@/lib/types";

const KINDS = [
  { key: "weight_kg", label: "體重", unit: "kg" },
  { key: "body_fat_pct", label: "體脂", unit: "%" },
  { key: "waist_cm", label: "腰圍", unit: "cm" },
] as const;

type Kind = (typeof KINDS)[number]["key"];

/** 身體數據：記錄表單＋趨勢圖＋歷史紀錄。userId 為 null 代表記錄自己。 */
export function MetricsPanel({
  metrics,
  userId,
  viewerId,
}: {
  metrics: Metric[];
  userId: string | null;
  viewerId: string;
}) {
  const available = KINDS.filter((k) => metrics.some((m) => m[k.key] != null));
  const [kind, setKind] = useState<Kind>(available[0]?.key ?? "weight_kg");
  const [open, setOpen] = useState(metrics.length === 0);
  const [day, setDay] = useState(todayInTaipei());
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [waist, setWaist] = useState("");
  const [note, setNote] = useState("");
  const { pending, error, run } = useAction();
  const del = useAction();

  const sorted = [...metrics].sort((a, b) => a.measured_on.localeCompare(b.measured_on) || a.created_at.localeCompare(b.created_at));
  const current = KINDS.find((k) => k.key === kind)!;
  const points = sorted.filter((m) => m[kind] != null).map((m) => ({ day: m.measured_on, value: Number(m[kind]) }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () =>
        addMetric({ userId, measuredOn: day, weightKg: num(weight), bodyFatPct: num(fat), waistCm: num(waist), note }),
      () => {
        setWeight("");
        setFat("");
        setWaist("");
        setNote("");
        setOpen(false);
      },
    );
  };

  return (
    <div className="space-y-4">
      {points.length > 0 ? (
        <div>
          <div className="mb-2 flex gap-1" role="tablist" aria-label="選擇數據">
            {KINDS.filter((k) => metrics.some((m) => m[k.key] != null)).map((k) => (
              <button
                key={k.key}
                type="button"
                role="tab"
                aria-selected={kind === k.key}
                onClick={() => setKind(k.key)}
                className={`rounded-full px-3 py-1 text-sm ${kind === k.key ? "bg-track text-track-ink" : "text-ink-2 hover:bg-track-soft"}`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <MetricChart points={points} unit={current.unit} label={current.label} />
          {points.length >= 2 ? (
            <p className="mt-1 text-sm text-ink-2">
              跟 {plainDateLabel(points[0].day)} 比：
              <span className="num font-bold text-ink">
                {(points[points.length - 1].value - points[0].value > 0 ? "+" : "") +
                  (points[points.length - 1].value - points[0].value).toFixed(1)}
                {current.unit}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-surface-2 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="m-day">日期</Label>
              <Input id="m-day" type="date" value={day} max={todayInTaipei()} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="m-w">體重 kg</Label>
              <Input id="m-w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="72.5" />
            </div>
            <div>
              <Label htmlFor="m-f">體脂 %</Label>
              <Input id="m-f" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="24" />
            </div>
            <div>
              <Label htmlFor="m-c">腰圍 cm</Label>
              <Input id="m-c" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="88" />
            </div>
          </div>
          <div>
            <Label htmlFor="m-n" hint="選填">
              備註
            </Label>
            <Input id="m-n" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="例如：早上空腹量" />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || (!weight && !fat && !waist)}>
              {pending ? "儲存中…" : "儲存紀錄"}
            </Button>
            {metrics.length > 0 ? (
              <Button variant="ghost" onClick={() => setOpen(false)}>
                取消
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          新增一筆紀錄
        </Button>
      )}

      {sorted.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm text-track">看全部 {sorted.length} 筆紀錄</summary>
          <ErrorText>{del.error}</ErrorText>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-ink-3">
              <tr>
                <th className="py-1.5 font-normal">日期</th>
                <th className="py-1.5 font-normal">體重</th>
                <th className="py-1.5 font-normal">體脂</th>
                <th className="py-1.5 font-normal">腰圍</th>
                <th className="py-1.5 font-normal" aria-label="動作" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...sorted].reverse().map((m) => (
                <tr key={m.id}>
                  <td className="py-2 text-ink-2">
                    {plainDateLabel(m.measured_on)}
                    {m.note ? <span className="block text-xs text-ink-3">{m.note}</span> : null}
                  </td>
                  <td className="num py-2">{m.weight_kg ?? "—"}</td>
                  <td className="num py-2">{m.body_fat_pct ?? "—"}</td>
                  <td className="num py-2">{m.waist_cm ?? "—"}</td>
                  <td className="py-2 text-right">
                    {m.user_id === viewerId || m.recorded_by === viewerId ? (
                      <button
                        type="button"
                        aria-label="刪除這筆"
                        disabled={del.pending}
                        onClick={() => {
                          if (window.confirm("確定刪除這筆紀錄嗎？")) del.run(() => deleteMetric(m.id));
                        }}
                        className="rounded p-1 text-ink-3 hover:text-stop"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}
