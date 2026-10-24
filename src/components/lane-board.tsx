import { Flame } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui";
import type { MemberProgress } from "@/lib/types";

/** 本週家族排行：每人一條跑道，跑到終點 = 完成本週作業 */
export function LaneBoard({
  members,
  meId,
  renderAction,
}: {
  members: MemberProgress[];
  meId?: string;
  renderAction?: (m: MemberProgress) => ReactNode;
}) {
  const ranked = [...members]
    .filter((m) => m.week_target > 0)
    .sort((a, b) => b.week_done / b.week_target - a.week_done / a.week_target || b.streak - a.streak);
  if (ranked.length === 0) return <p className="text-sm text-ink-3">教練出作業後，這裡會顯示每個人本週的進度。</p>;

  return (
    <ol className="space-y-2.5">
      {ranked.map((m, i) => {
        const pct = Math.min(100, Math.round((m.week_done / m.week_target) * 100));
        const isMe = m.user_id === meId;
        return (
          <li key={m.user_id} className="flex items-center gap-3">
            <span className="num w-5 text-center text-lg font-bold text-ink-3">{i + 1}</span>
            <Avatar name={m.display_name} id={m.user_id} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-[0.9375rem] ${isMe ? "font-bold text-track" : "text-ink"}`}>
                  {m.display_name}
                  {isMe ? "（你）" : ""}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-3">
                  {m.streak > 0 ? (
                    <span className="flex items-center gap-0.5 text-track">
                      <Flame className="size-3.5" aria-hidden />
                      <span className="num font-bold">{m.streak}</span>
                      <span className="sr-only">天連續打卡</span>
                    </span>
                  ) : null}
                  <span className="num text-sm text-ink">
                    {m.week_done}/{m.week_target}
                  </span>
                </span>
              </div>
              {/* 跑道：虛線是分道線，終點是黃色 */}
              <div className="relative mt-1 h-3 rounded-full bg-track-soft">
                <div className="absolute inset-y-0 right-0 w-1.5 rounded-r-full bg-lane" aria-hidden />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${pct >= 100 ? "bg-go" : "bg-track"}`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>
            </div>
            {renderAction ? <div className="shrink-0">{renderAction(m)}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}
