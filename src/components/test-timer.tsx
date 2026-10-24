"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Timer = { kind: "countdown"; seconds: number } | { kind: "stopwatch"; max?: number };

/** 嗶一聲（倒數結束時提醒教練停止計數） */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // 不支援就算了
  }
}

/** 單調時鐘（只在事件與動畫回呼裡呼叫） */
function clock() {
  return performance.now();
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 小考計時器：倒數（30 秒、2 分鐘）或碼錶（起身繞物、單足立）。
 * 碼錶停下後可以一鍵把秒數填進成績欄。
 */
export function TestTimer({ timer, onStopwatchResult, label }: { timer: Timer; onStopwatchResult?: (sec: number) => void; label: string }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // ms
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);
  const [done, setDone] = useState(false);

  const total = timer.kind === "countdown" ? timer.seconds * 1000 : (timer.max ?? 600) * 1000;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      const now = clock();
      const e = baseRef.current + (now - (startRef.current ?? now));
      if (e >= total) {
        setElapsed(total);
        setRunning(false);
        setDone(true);
        baseRef.current = total;
        beep();
        if (timer.kind === "stopwatch") onStopwatchResult?.(total / 1000);
        return;
      }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, total, timer.kind, onStopwatchResult]);

  const start = () => {
    if (done) reset();
    startRef.current = clock();
    setRunning(true);
  };
  const pause = () => {
    baseRef.current = elapsed;
    setRunning(false);
    if (timer.kind === "stopwatch" && elapsed > 0) onStopwatchResult?.(Math.round(elapsed / 10) / 100);
  };
  const reset = () => {
    setRunning(false);
    setDone(false);
    setElapsed(0);
    baseRef.current = 0;
  };

  const display =
    timer.kind === "countdown" ? fmtClock(total - elapsed) : `${(elapsed / 1000).toFixed(2)}`;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
      <span
        className={`num min-w-[5.5rem] text-3xl font-bold tabular-nums ${done ? "text-stop" : running ? "text-track" : "text-ink"}`}
        aria-live="polite"
        aria-label={`${label}計時`}
      >
        {display}
        {timer.kind === "stopwatch" ? <span className="ml-0.5 text-base font-normal text-ink-3">秒</span> : null}
      </span>
      <div className="ml-auto flex gap-2">
        {running ? (
          <button
            type="button"
            onClick={pause}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-lane px-4 font-medium text-lane-ink"
          >
            <Pause className="size-5" aria-hidden />
            {timer.kind === "stopwatch" ? "停" : "暫停"}
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-track px-4 font-medium text-track-ink"
          >
            <Play className="size-5" aria-hidden />
            {done ? "再一次" : elapsed > 0 ? "繼續" : "開始"}
          </button>
        )}
        {elapsed > 0 && !running ? (
          <button
            type="button"
            onClick={reset}
            aria-label="歸零"
            className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-ink-2"
          >
            <RotateCcw className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>
      {done && timer.kind === "countdown" ? <span className="sr-only">時間到</span> : null}
    </div>
  );
}
