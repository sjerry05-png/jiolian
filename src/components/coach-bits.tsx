import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { dayLabel, LOCATION_LABEL, money, timeLabel } from "@/lib/format";
import type { MemberProgress, SessionOverview } from "@/lib/types";

/** 教練看的課程列：時間、地點、人數、目前每人價格、這堂收入 */
export function SessionRow({ s, showGroup = true }: { s: SessionOverview; showGroup?: boolean }) {
  const started = s.has_started;
  return (
    <Link href={`/coach/sessions/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
      <div className="w-16 shrink-0 text-center">
        <p className="text-xs text-ink-3">{dayLabel(s.starts_at)}</p>
        <p className="num text-xl font-bold text-ink">{timeLabel(s.starts_at)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-ink">
          {showGroup ? s.group_name : (s.title ?? "小團課")}
          {s.status === "cancelled" ? <span className="ml-2 text-sm text-ink-3">已取消</span> : null}
          {s.status === "completed" ? <span className="ml-2 text-sm text-go">已結算</span> : null}
          {s.status === "scheduled" && started ? <span className="ml-2 text-sm font-medium text-stop">待結算</span> : null}
        </p>
        <p className="truncate text-sm text-ink-3">
          {LOCATION_LABEL[s.location_type]}
          {s.location ? `・${s.location}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm text-ink-2">
          <span className="num text-lg font-bold text-ink">{s.headcount}</span>/{s.capacity} 人
        </p>
        <p className="num text-xs text-ink-3">
          每人 {money(s.price_now)}・共 {money(s.price_now * s.headcount)}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
}

/** 學員狀態的一句話說明 */
export function progressReason(m: MemberProgress): string {
  if (m.status === "none") return "還沒有作業";
  if (m.status === "red") return m.last_checkin_day ? `${m.days_since} 天沒打卡` : "加入後還沒打過卡";
  if (m.status === "yellow") return m.days_since >= 2 ? `${m.days_since} 天沒打卡` : `本週落後（${m.week_done}/${m.week_target}）`;
  return m.streak > 1 ? `連續 ${m.streak} 天` : `本週 ${m.week_done}/${m.week_target}`;
}
