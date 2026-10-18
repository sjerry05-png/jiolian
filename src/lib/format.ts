import { TIME_ZONE } from "@/lib/config";
import type { BookingStatus, LocationType, PaidMethod } from "@/lib/types";

const moneyFmt = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });

export function money(n: number | null | undefined): string {
  return `$${moneyFmt.format(n ?? 0)}`;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function partsInTaipei(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: get("hour") === "24" ? "00" : get("hour"),
    mm: get("minute"),
    wd: weekdayIndex,
  };
}

/** n 天前（台灣日期，YYYY-MM-DD） */
export function taipeiDateDaysAgo(days: number): string {
  return todayInTaipei(new Date(Date.now() - days * 86400_000));
}

/** 台灣時間的今天（YYYY-MM-DD） */
export function todayInTaipei(now = new Date()): string {
  const { y, m, d } = partsInTaipei(now);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 10/18（六） */
export function dayLabel(iso: string | Date): string {
  const { m, d, wd } = partsInTaipei(typeof iso === "string" ? new Date(iso) : iso);
  return `${m}/${d}（${WEEKDAYS[wd]}）`;
}

/** 10/18（六）09:00 */
export function dateTimeLabel(iso: string): string {
  const p = partsInTaipei(new Date(iso));
  return `${p.m}/${p.d}（${WEEKDAYS[p.wd]}）${p.hh}:${p.mm}`;
}

export function timeLabel(iso: string): string {
  const p = partsInTaipei(new Date(iso));
  return `${p.hh}:${p.mm}`;
}

/** 日期字串（YYYY-MM-DD，台灣日期）轉成 10/18（六） */
export function plainDateLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}（${WEEKDAYS[wd]}）`;
}

/** 「3 小時後」「2 天前」 */
export function relativeLabel(iso: string, now = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const future = diff > 0;
  const min = Math.round(abs / 60000);
  let s: string;
  if (min < 1) return "剛剛";
  if (min < 60) s = `${min} 分鐘`;
  else if (min < 60 * 24) s = `${Math.round(min / 60)} 小時`;
  else s = `${Math.round(min / 60 / 24)} 天`;
  return future ? `${s}後` : `${s}前`;
}

export const LOCATION_LABEL: Record<LocationType, string> = {
  home: "學員家中",
  gym: "健身房",
  outdoor: "戶外",
  online: "線上",
};

export const BOOKING_LABEL: Record<BookingStatus, string> = {
  going: "要來",
  declined: "不來",
  late_cancel: "臨時取消",
  attended: "出席",
  no_show: "缺席",
};

export const PAID_LABEL: Record<PaidMethod, string> = {
  cash: "現金",
  transfer: "轉帳",
  linepay: "LINE Pay",
  other: "其他",
  waived: "免收",
};

export const FEELINGS = [
  { value: 1, emoji: "😫", label: "好累" },
  { value: 2, emoji: "😕", label: "勉強" },
  { value: 3, emoji: "🙂", label: "還好" },
  { value: 4, emoji: "😄", label: "不錯" },
  { value: 5, emoji: "🔥", label: "超讚" },
] as const;

export function feelingEmoji(v: number | null | undefined): string {
  return FEELINGS.find((f) => f.value === v)?.emoji ?? "";
}

/** 依價目表算 n 人時每人價格（與資料庫 fit_internal.price_for 相同規則） */
export function priceFor(ladder: number[], headcount: number): number {
  const n = Math.min(Math.max(headcount, 1), ladder.length);
  return ladder[n - 1];
}

/** 由一對一價格產生建議價目表（人越多每人越便宜、教練總收入越高） */
export function suggestLadder(soloPrice: number, size = 6): number[] {
  const factors = [1, 0.65, 0.5, 0.42, 0.37, 0.33, 0.3, 0.28, 0.26, 0.24, 0.23, 0.22];
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    const raw = Math.round((soloPrice * factors[i]) / 5) * 5;
    out.push(Math.max(1, Math.min(raw, out[i - 1] ?? raw)));
  }
  return out;
}

/** 把 datetime-local 的值（台灣時間）轉成 ISO 字串 */
export function taipeiLocalToIso(local: string): string {
  // local 形如 2026-10-18T09:00，台灣固定 UTC+8、沒有日光節約
  return new Date(`${local}:00+08:00`).toISOString();
}

/** ISO 轉成 datetime-local 輸入框的值（台灣時間） */
export function isoToTaipeiLocal(iso: string): string {
  const p = partsInTaipei(new Date(iso));
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}T${p.hh}:${p.mm}`;
}
