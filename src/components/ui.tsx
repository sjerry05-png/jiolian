import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { ProgressStatus } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "lane";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-track text-track-ink hover:bg-track-strong disabled:opacity-50",
  secondary: "bg-surface text-ink border border-line hover:border-track hover:text-track disabled:opacity-50",
  ghost: "text-track hover:bg-track-soft disabled:opacity-50",
  danger: "bg-surface text-stop border border-line hover:border-stop disabled:opacity-50",
  lane: "bg-lane text-lane-ink hover:brightness-95 disabled:opacity-50",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-xl gap-2",
  lg: "h-14 px-6 text-base rounded-2xl gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors select-none cursor-pointer disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-medium text-ink-2">
      <span>{children}</span>
      {hint ? <span className="text-xs font-normal text-ink-3">{hint}</span> : null}
    </label>
  );
}

const FIELD =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink placeholder:text-ink-3 focus:border-track focus:outline-none focus:ring-2 focus:ring-track/25";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${FIELD} h-12 ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${FIELD} min-h-24 py-3 leading-relaxed ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${FIELD} h-12 appearance-none bg-[length:12px] pr-9 ${className}`} {...props} />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-stop-soft px-3 py-2 text-sm text-stop">
      {children}
    </p>
  );
}

const AVATAR_COLORS = [
  "bg-[#2347c8] text-white",
  "bg-[#ffd23f] text-[#3a2e00]",
  "bg-[#1b8f52] text-white",
  "bg-[#7a4fd6] text-white",
  "bg-[#e0662f] text-white",
  "bg-[#0f8a9c] text-white",
];

export function Avatar({ name, id, size = 36 }: { name: string; id: string; size?: number }) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length];
  // 中文名取最後一個字：同一個家庭常常同姓（林爸、林媽），取最後一字才分得出來
  const chars = Array.from(name.trim());
  const isCjk = /[\u3400-\u9fff]/.test(chars[chars.length - 1] ?? "");
  const initial = (isCjk ? chars[chars.length - 1] : chars[0]?.toUpperCase()) ?? "?";
  return (
    <span
      aria-hidden
      className={`display inline-flex shrink-0 items-center justify-center rounded-full ${color}`}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
    >
      {initial}
    </span>
  );
}

const STATUS_STYLE: Record<ProgressStatus, { dot: string; text: string; label: string }> = {
  red: { dot: "bg-stop", text: "text-stop", label: "很久沒動" },
  yellow: { dot: "bg-warn", text: "text-warn", label: "進度落後" },
  green: { dot: "bg-go", text: "text-go", label: "正常" },
  none: { dot: "bg-line", text: "text-ink-3", label: "還沒出作業" },
};

export function StatusDot({ status, withLabel = false }: { status: ProgressStatus; withLabel?: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`inline-block size-2.5 rounded-full ${s.dot}`} aria-hidden />
      {withLabel ? s.label : <span className="sr-only">{s.label}</span>}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="display text-xl text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-5 py-8 text-center">
      <p className="display text-lg text-ink">{title}</p>
      {children ? <div className="mx-auto mt-1.5 max-w-sm text-sm text-ink-2">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-surface p-4 sm:p-5 ${className}`}>{children}</section>;
}
