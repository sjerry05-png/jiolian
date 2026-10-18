import type { Metadata } from "next";
import Link from "next/link";
import { progressReason, SessionRow } from "@/components/coach-bits";
import { QuickMessage } from "@/components/quick-message";
import { Avatar, ButtonLink, Empty, SectionTitle, StatusDot } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { money, todayInTaipei } from "@/lib/format";
import { coachGroups, unsettledSessions, upcomingSessions } from "@/lib/queries";
import type { CoachStats, MemberProgress } from "@/lib/types";

export const metadata: Metadata = { title: "看板" };

export default async function CoachDashboard() {
  const { supabase, user, profile } = await requireProfile("coach");
  const groups = await coachGroups(supabase, user.id);

  if (groups.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="display text-3xl text-ink">{profile.display_name}，歡迎</h1>
        <Empty
          title="先開第一個小團"
          action={
            <ButtonLink href="/coach/groups/new" size="lg">
              開一個小團
            </ButtonLink>
          }
        >
          一個家庭、一群同事或朋友就是一個小團。設定好價目表，把邀請連結傳到 LINE 群組，大家點開就能加入。
        </Empty>
      </div>
    );
  }

  const ids = groups.map((g) => g.id);
  const today = todayInTaipei();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [statsRes, upcoming, unsettled, ...progressRes] = await Promise.all([
    supabase.rpc("fit_coach_stats", { p_from: monthStart, p_to: today }),
    upcomingSessions(supabase, ids, { untilDays: 7 }),
    unsettledSessions(supabase, ids),
    ...groups.map((g) => supabase.rpc("fit_group_progress", { p_group_id: g.id })),
  ]);
  const stats = statsRes.data as CoachStats | null;
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const attention = groups.flatMap((g, i) =>
    ((progressRes[i].data ?? []) as MemberProgress[])
      .filter((m) => m.status === "red" || m.status === "yellow")
      .map((m) => ({ ...m, group_id: g.id })),
  );
  const totalMembers = progressRes.reduce((n, r) => n + ((r.data as MemberProgress[] | null)?.length ?? 0), 0);
  const future = upcoming.filter((s) => !s.has_started);
  const uplift = stats && stats.solo_equivalent > 0 ? Math.round((stats.billed / stats.solo_equivalent - 1) * 100) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl text-ink">{profile.display_name}的看板</h1>
        <p className="mt-1 text-ink-2">
          {groups.length} 個小團・{totalMembers} 位學員
        </p>
      </div>

      {unsettled.length > 0 ? (
        <section className="rounded-2xl bg-stop-soft p-1">
          <p className="px-3 pt-2 pb-1 text-sm font-medium text-stop">有 {unsettled.length} 堂課上完還沒結算</p>
          <div className="divide-y divide-line overflow-hidden rounded-xl bg-surface">
            {unsettled.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="month">
        <h2 id="month" className="sr-only">
          本月收入
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 rounded-2xl bg-track p-4 text-track-ink sm:col-span-1">
            <p className="text-sm opacity-85">本月應收</p>
            <p className="num text-4xl font-bold">{money(stats?.billed ?? 0)}</p>
            <p className="mt-1 text-sm opacity-85">
              {stats?.sessions ?? 0} 堂課・平均每堂 {stats?.avg_headcount ?? 0} 人
              {uplift != null && uplift > 0 ? `・比一對一多 ${uplift}%` : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm text-ink-3">已收</p>
            <p className="num text-3xl font-bold text-go">{money(stats?.collected ?? 0)}</p>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm text-ink-3">還沒收</p>
            <p className={`num text-3xl font-bold ${(stats?.outstanding ?? 0) > 0 ? "text-stop" : "text-ink"}`}>
              {money(stats?.outstanding ?? 0)}
            </p>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>需要你關心</SectionTitle>
        {attention.length === 0 ? (
          <p className="rounded-2xl bg-go-soft px-4 py-3 text-go">大家這週都有在練，太好了。</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {attention.map((m) => (
              <li key={`${m.group_id}-${m.user_id}`} className="flex items-center gap-3 px-4 py-3">
                <StatusDot status={m.status} />
                <Avatar name={m.display_name} id={m.user_id} size={34} />
                <Link href={`/coach/students/${m.user_id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{m.display_name}</p>
                  <p className="truncate text-sm text-ink-3">
                    {progressReason(m)}
                    {groups.length > 1 ? `・${groupName.get(m.group_id)}` : ""}
                  </p>
                </Link>
                <QuickMessage kind="nudge" recipientId={m.user_id} recipientName={m.display_name} groupId={m.group_id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle
          action={
            <Link href="/coach/sessions" className="text-sm text-track hover:underline">
              全部課程
            </Link>
          }
        >
          未來 7 天的課
        </SectionTitle>
        {future.length === 0 ? (
          <Empty title="這週還沒排課">到小團頁面排課，可以一次排好每週固定時段。</Empty>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
            {future.map((s) => (
              <SessionRow key={s.id} s={s} showGroup={groups.length > 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
