import type { Metadata } from "next";
import { SessionTicket } from "@/components/session-ticket";
import { Empty, SectionTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { BOOKING_LABEL, dateTimeLabel, money, PAID_LABEL } from "@/lib/format";
import { bookingsForSessions, pastSessions, studentGroups, upcomingSessions } from "@/lib/queries";

export const metadata: Metadata = { title: "課程" };

export default async function StudentSessions() {
  const { supabase, user } = await requireProfile("student");
  const groups = await studentGroups(supabase, user.id);
  const ids = groups.map((g) => g.id);
  const [upcomingRaw, pastRaw] = await Promise.all([
    upcomingSessions(supabase, ids, { untilDays: 60, includeCancelled: true }),
    pastSessions(supabase, ids, 30),
  ]);
  // 剛上完、已結算的課移到「上過的課」
  const upcoming = upcomingRaw.filter((s) => s.status !== "completed");
  const past = [...upcomingRaw.filter((s) => s.status === "completed").reverse(), ...pastRaw];
  const bookings = await bookingsForSessions(supabase, [...upcoming, ...past].map((s) => s.id));
  const mine = (sid: string) => bookings.find((b) => b.session_id === sid && b.user_id === user.id) ?? null;
  const myPast = past.filter((s) => mine(s.id) || s.status === "cancelled");

  return (
    <div className="space-y-8">
      <h1 className="display text-3xl text-ink">課程</h1>

      <section>
        <SectionTitle>接下來</SectionTitle>
        {upcoming.length === 0 ? (
          <Empty title="最近沒有排課">教練排課後會出現在這裡。</Empty>
        ) : (
          <div className="space-y-3">
            {upcoming.map((s) =>
              s.status === "cancelled" ? (
                <div key={s.id} className="rounded-2xl border border-dashed border-line px-4 py-3 text-ink-3">
                  <span className="line-through">{dateTimeLabel(s.starts_at)}</span>
                  <span className="ml-2 text-sm">教練取消了這堂課</span>
                </div>
              ) : (
                <SessionTicket key={s.id} session={s} booking={mine(s.id)} showGroup={groups.length > 1} />
              ),
            )}
          </div>
        )}
      </section>

      <section id="past">
        <SectionTitle>上過的課與費用</SectionTitle>
        {myPast.length === 0 ? (
          <Empty title="還沒有上課紀錄" />
        ) : (
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {myPast.map((s) => {
              const b = mine(s.id);
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{dateTimeLabel(s.starts_at)}</p>
                    <p className="text-sm text-ink-3">
                      {s.status === "cancelled"
                        ? "教練取消"
                        : s.status === "scheduled"
                          ? "等教練結算"
                          : `${s.headcount} 人上課・每人 ${money(b?.price_per_person ?? s.price_now)}`}
                      {b ? `・${BOOKING_LABEL[b.status]}` : ""}
                      {b && b.guests > 0 ? `（含 ${b.guests} 位家人）` : ""}
                    </p>
                  </div>
                  {b?.amount_due != null ? (
                    <div className="text-right">
                      <p className="num text-lg font-bold text-ink">{money(b.amount_due)}</p>
                      <p className={`text-xs ${b.paid_at ? "text-go" : "text-stop"}`}>
                        {b.paid_method ? (b.paid_method === "waived" ? "教練免收" : `已付・${PAID_LABEL[b.paid_method]}`) : "未付"}
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
