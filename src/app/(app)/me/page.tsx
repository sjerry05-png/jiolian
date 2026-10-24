import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Flame, Megaphone } from "lucide-react";
import { HabitRow } from "@/components/habit-row";
import { SessionTicket } from "@/components/session-ticket";
import { Empty, Panel, SectionTitle } from "@/components/ui";
import { WellbeingCard } from "@/components/wellbeing";
import { requireProfile } from "@/lib/auth";
import { money, relativeLabel, todayInTaipei } from "@/lib/format";
import { GOAL_RERATE_DAYS } from "@/lib/fitness";
import { bookingsForSessions, mondayOf, profilesByIds, studentGroups, upcomingSessions } from "@/lib/queries";
import type { Goal, GoalRating, Message, MySummary, TodayHabit, Wellbeing } from "@/lib/types";

export const metadata: Metadata = { title: "今天" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", hour: "numeric", hour12: false }).format(new Date()));
  if (h < 11) return "早安";
  if (h < 18) return "午安";
  return "晚安";
}

export default async function StudentToday(props: PageProps<"/me">) {
  const sp = await props.searchParams;
  const { supabase, user, profile } = await requireProfile("student");

  const thisMonday = mondayOf(todayInTaipei());
  const [groups, summaryRes, todayRes, unreadRes, wellRes, goalsRes, ratingsRes] = await Promise.all([
    studentGroups(supabase, user.id),
    supabase.rpc("fit_my_summary"),
    supabase.rpc("fit_my_today"),
    supabase
      .from("fit_messages")
      .select("id, group_id, sender_id, recipient_id, kind, body, read_at, created_at")
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("fit_wellbeing")
      .select("user_id, week_start, pain, pain_area, sleep, energy, note, updated_at")
      .eq("user_id", user.id)
      .eq("week_start", thisMonday)
      .maybeSingle<Wellbeing>(),
    supabase
      .from("fit_goals")
      .select("id, user_id, title, share_with_group, created_by, achieved_at, archived_at, created_at")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .is("achieved_at", null),
    supabase.from("fit_goal_ratings").select("goal_id, rated_on").eq("user_id", user.id),
  ]);
  const wellbeing = wellRes.data ?? null;
  const lastRated = new Map<string, string>();
  for (const r of (ratingsRes.data ?? []) as Pick<GoalRating, "goal_id" | "rated_on">[]) {
    if ((lastRated.get(r.goal_id) ?? "") < r.rated_on) lastRated.set(r.goal_id, r.rated_on);
  }
  const dueGoals = ((goalsRes.data ?? []) as Goal[]).filter((g) => {
    const last = lastRated.get(g.id);
    return !last || (Date.parse(todayInTaipei()) - Date.parse(last)) / 86400_000 >= GOAL_RERATE_DAYS;
  });
  const summary = (summaryRes.data ?? { streak: 0, week_target: 0, week_done: 0, unread: 0, unpaid: 0 }) as MySummary;
  const habits = (todayRes.data ?? []) as TodayHabit[];
  const unread = (unreadRes.data ?? []) as Message[];

  const sessions = (
    await upcomingSessions(
      supabase,
      groups.map((g) => g.id),
      { limit: 4, untilDays: 21 },
    )
  )
    .filter((s) => s.status === "scheduled")
    .slice(0, 2);
  const bookings = await bookingsForSessions(
    supabase,
    sessions.map((s) => s.id),
  );
  const myBooking = (sid: string) => bookings.find((b) => b.session_id === sid && b.user_id === user.id) ?? null;
  const [senders, habitDatesRes] = await Promise.all([
    profilesByIds(
      supabase,
      unread.map((m) => m.sender_id),
    ),
    habits.length
      ? supabase
          .from("fit_habits")
          .select("id, starts_on")
          .in(
            "id",
            habits.map((h) => h.habit_id),
          )
      : Promise.resolve({ data: [] as { id: string; starts_on: string }[] }),
  ]);
  const today = todayInTaipei();
  // 作業今天才開始的話，就沒有「昨天」可以補
  const startedBeforeToday = new Set(
    ((habitDatesRes.data ?? []) as { id: string; starts_on: string }[]).filter((h) => h.starts_on < today).map((h) => h.id),
  );

  const doneToday = habits.filter((h) => h.done_today).length;
  const joinedGroup = typeof sp.joined === "string" ? groups.find((g) => g.id === sp.joined) : undefined;

  if (groups.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="display text-3xl text-ink">
          {greeting()}，{profile.display_name}
        </h1>
        <Empty title="你還沒加入任何小團">
          請你的教練傳邀請連結給你，打開連結就能加入。加入後，教練出的作業和排的課都會出現在這裡。
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {joinedGroup ? (
        <p className="rounded-2xl bg-go-soft px-4 py-3 text-go">已加入「{joinedGroup.name}」，一起練吧！</p>
      ) : null}

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl text-ink">
            {greeting()}，{profile.display_name}
          </h1>
          <p className="mt-1 text-ink-2">
            {habits.length === 0
              ? "教練還沒出作業"
              : doneToday === habits.length
                ? "今天的作業都完成了"
                : `今天還有 ${habits.length - doneToday} 項作業`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="flex items-center gap-1 text-track">
            <Flame className="size-6" aria-hidden />
            <span className="num text-4xl font-bold leading-none">{summary.streak}</span>
          </span>
          <span className="mt-1 text-xs text-ink-3">連續打卡天數</span>
        </div>
      </div>

      {unread.length > 0 ? (
        <Link href="/messages" className="block rounded-2xl bg-lane px-4 py-3 text-lane-ink">
          {unread.slice(0, 1).map((m) => (
            <span key={m.id} className="flex items-start gap-2">
              <Megaphone className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span>
                <span className="font-bold">{senders.get(m.sender_id)?.display_name ?? "教練"}</span>
                <span className="ml-1 text-sm opacity-80">{relativeLabel(m.created_at)}</span>
                <span className="block">{m.body}</span>
                {unread.length > 1 ? <span className="mt-0.5 block text-sm opacity-80">還有 {unread.length - 1} 則未讀</span> : null}
              </span>
            </span>
          ))}
        </Link>
      ) : null}

      <section>
        <SectionTitle
          action={
            summary.week_target > 0 ? (
              <span className="text-sm text-ink-2">
                本週 <span className="num font-bold text-ink">{summary.week_done}</span>/{summary.week_target} 次
              </span>
            ) : null
          }
        >
          今天的作業
        </SectionTitle>
        {summary.week_target > 0 ? (
          <div className="mb-1 h-2 overflow-hidden rounded-full bg-track-soft" aria-hidden>
            <div
              className="h-full rounded-full bg-track transition-[width]"
              style={{ width: `${Math.min(100, Math.round((summary.week_done / summary.week_target) * 100))}%` }}
            />
          </div>
        ) : null}
        {habits.length === 0 ? (
          <Empty title="還沒有作業">教練出作業後會出現在這裡，每天練完回來打卡。</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {habits.map((h) => (
              <HabitRow key={h.habit_id} habit={h} showGroup={groups.length > 1} canBackfill={startedBeforeToday.has(h.habit_id)} />
            ))}
          </ul>
        )}
      </section>

      <section id="wellbeing" className="scroll-mt-20">
        <SectionTitle>{wellbeing ? "這週身體感受" : "這週身體還好嗎？"}</SectionTitle>
        {!wellbeing ? <p className="-mt-1 mb-3 text-sm text-ink-2">一週填一次，10 秒就好。教練會看到，上課時幫你調整。</p> : null}
        <WellbeingCard current={wellbeing} />
        {dueGoals.length > 0 ? (
          <Link
            href="/me/progress#goals"
            className="mt-3 flex items-center gap-3 rounded-2xl bg-lane-soft px-4 py-3 text-ink hover:brightness-95"
          >
            <span className="text-2xl" aria-hidden>
              🎯
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">生活目標該重新打分數了</span>
              <span className="block truncate text-sm text-ink-2">{dueGoals.map((g) => `「${g.title}」`).join("")}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
          </Link>
        ) : null}
      </section>

      <section>
        <SectionTitle
          action={
            <Link href="/me/sessions" className="text-sm text-track hover:underline">
              全部課程
            </Link>
          }
        >
          接下來的課
        </SectionTitle>
        {sessions.length === 0 ? (
          <Empty title="最近沒有排課">教練排課後，你可以在這裡報名，也能幫家人一起報。</Empty>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <SessionTicket key={s.id} session={s} booking={myBooking(s.id)} showGroup={groups.length > 1} />
            ))}
          </div>
        )}
      </section>

      {summary.unpaid > 0 ? (
        <Panel className="flex items-center justify-between">
          <span className="text-ink-2">待付給教練</span>
          <Link href="/me/sessions#past" className="num text-2xl font-bold text-stop">
            {money(summary.unpaid)}
          </Link>
        </Panel>
      ) : null}
    </div>
  );
}
