import type { Metadata } from "next";
import { SessionRow } from "@/components/coach-bits";
import { ButtonLink, Empty, SectionTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { dayLabel } from "@/lib/format";
import { coachGroups, pastSessions, unsettledSessions, upcomingSessions } from "@/lib/queries";

export const metadata: Metadata = { title: "課程" };

export default async function CoachSessions() {
  const { supabase, user } = await requireProfile("coach");
  const groups = await coachGroups(supabase, user.id);
  const ids = groups.map((g) => g.id);
  const [upcoming, unsettled, past] = await Promise.all([
    upcomingSessions(supabase, ids, { untilDays: 60 }),
    unsettledSessions(supabase, ids),
    pastSessions(supabase, ids, 15),
  ]);
  const future = upcoming.filter((s) => !s.has_started);
  const byDay = new Map<string, typeof future>();
  for (const s of future) {
    const k = dayLabel(s.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }

  return (
    <div className="space-y-8">
      <h1 className="display text-3xl text-ink">課程</h1>

      {unsettled.length > 0 ? (
        <section>
          <SectionTitle>待結算</SectionTitle>
          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-2 ring-stop/30">
            {unsettled.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle>接下來</SectionTitle>
        {future.length === 0 ? (
          <Empty
            title="還沒排課"
            action={
              groups[0] ? (
                <ButtonLink href={`/coach/groups/${groups[0].id}?tab=sessions`} variant="secondary">
                  去小團排課
                </ButtonLink>
              ) : null
            }
          >
            到小團的「課程」分頁排課，可以一次排好每週固定時段。
          </Empty>
        ) : (
          <div className="space-y-4">
            {[...byDay.entries()].map(([day, list]) => (
              <div key={day}>
                <h3 className="mb-1.5 text-sm font-medium text-ink-2">{day}</h3>
                <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
                  {list.map((s) => (
                    <SessionRow key={s.id} s={s} showGroup />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 ? (
        <section>
          <SectionTitle>最近上過的課</SectionTitle>
          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
            {past.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
