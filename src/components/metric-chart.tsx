"use client";

import { useMemo, useRef, useState } from "react";
import { plainDateLabel } from "@/lib/format";

interface Point {
  day: string; // YYYY-MM-DD
  value: number;
}

const W = 640;
const H = 200;
const pad = { l: 40, r: 56, t: 16, b: 28 };

/** 單一數據的趨勢線（體重、體脂、腰圍擇一），滑過或點按顯示當天數值 */
export function MetricChart({ points, unit, label }: { points: Point[]; unit: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const times = points.map((p) => Date.parse(p.day));
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const vals = points.map((p) => p.value);
    let v0 = Math.min(...vals);
    let v1 = Math.max(...vals);
    const span = Math.max(v1 - v0, 1);
    v0 = Math.floor(v0 - span * 0.25);
    v1 = Math.ceil(v1 + span * 0.25);
    const x = (t: number) => (t1 === t0 ? (pad.l + W - pad.r) / 2 : pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r));
    const y = (v: number) => pad.t + (1 - (v - v0) / (v1 - v0)) * (H - pad.t - pad.b);
    const xy = points.map((p, i) => ({ x: x(times[i]), y: y(p.value), ...p }));
    const ticks = [v0, (v0 + v1) / 2, v1];
    return { xy, y, ticks };
  }, [points]);

  if (!geo) return null;
  const { xy, y, ticks } = geo;
  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1];
  const first = xy[0];
  const h = hover != null ? xy[hover] : null;

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < xy.length; i++) if (Math.abs(xy[i].x - sx) < Math.abs(xy[best].x - sx)) best = i;
    setHover(best);
  };

  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <figure className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`${label}趨勢：從 ${fmt(first.value)}${unit} 到 ${fmt(last.value)}${unit}`}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--ink-3)" className="num">
              {fmt(t)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize={12} fill="var(--ink-3)">
          {plainDateLabel(first.day)}
        </text>
        {xy.length > 1 ? (
          <text x={W - pad.r} y={H - 6} fontSize={12} fill="var(--ink-3)" textAnchor="end">
            {plainDateLabel(last.day)}
          </text>
        ) : null}
        <path d={path} fill="none" stroke="var(--track)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {xy.map((p, i) => (
          <circle key={p.day + i} cx={p.x} cy={p.y} r={i === xy.length - 1 ? 5 : 3} fill="var(--track)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        <text x={last.x + 10} y={last.y + 5} fontSize={15} fontWeight={700} fill="var(--ink)" className="num">
          {fmt(last.value)}
          {unit}
        </text>
        {h ? (
          <g>
            <line x1={h.x} x2={h.x} y1={pad.t} y2={H - pad.b} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={h.x} cy={h.y} r={6} fill="var(--track)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        ) : null}
      </svg>
      {h ? (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-surface shadow"
          style={{ left: `${(h.x / W) * 100}%`, transform: `translateX(${h.x > W * 0.7 ? "-100%" : "-50%"})` }}
        >
          {plainDateLabel(h.day)}・<span className="num font-bold">{fmt(h.value)}</span>
          {unit}
        </div>
      ) : null}
    </figure>
  );
}
