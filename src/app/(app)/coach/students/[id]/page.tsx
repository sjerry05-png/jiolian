import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckinCalendar } from "@/components/checkin-calendar";
import { progressReason } from "@/components/coach-bits";
import { MetricsPanel } from "@/components/metrics-panel";
import { QuickMessage } from "@/components/quick-message";
import { Avatar, ButtonLink, Panel, SectionTitle, StatusDot } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { BOOKING_LABEL, dateTimeLabel, feelingEmoji, money, PAID_LABEL, plainDateLabel, taipeiDateDaysAgo, todayInTaipei } from "@/lib/format";
import { coachGroups } from "@/lib/queries";
import type { Booking, Checkin, Habit, MemberProgress, Metric, Profile } from "@/lib/types";
import { ReactButtons } from "./react-buttons";

export const metadata: Metadata = { title: "學員" };

export default async function CoachStudentPage(props: PageProps<"/coach/students/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await requireProfile("coach");

  const { data: student } = await supabase
    .from("fit_profiles")
    .select("id, display_name, role, phone, bio")
    .eq("id", id)
    .maybeSingle<Profile>();
  if (!student || student.role !== "student") notFound();

  const groups = await coachGroups(supabase, user.id, true);
  const { data: memberships } = await supabase
    .from("fit_group_members")
    .select("group_id")
    .eq("user_id", id)
    .is("left_at", null)
    .in(
      "group_id",
      groups.map((g) => g.id),
    );
  const shared = groups.filter((g) => (memberships ?? []).some((m) => m.group_id === g.id));
  if (shared.length === 0) notFound();
  const sharedIds = shared.map((g) => g.id);

  const since = taipeiDateDaysAgo(80);
  const [progressList, checkinsRes, habitsRes, metricsRes, bookingsRes] = await Promise.all([
    Promise.all(shared.map((g) => supabase.rpc("fit_group_progress", { p_group_id: g.id }))),
    supabase
      .from("fit_checkins")
      .select("id, habit_id, group_id, user_id, day, feeling, note, coach_reaction, coach_comment, created_at")
      .eq("user_id", id)
      .in("group_id", sharedIds)
      .gte("day", since)
      .order("created_at", { ascending: false }),
    supabase.from("fit_habits").select("id, title").in("group_id", sharedIds),
    supabase
      .from("fit_metrics")
      .select("id, user_id, measured_on, weight_kg, body_fat_pct, waist_cm, note, recorded_by, created_at")
      .eq("user_id", id)
      .order("measured_on"),
    supabase
      .from("fit_bookings")
      .select("session_id, user_id, status, guests, price_per_person, amount_due, paid_at, paid_method")
      .eq("user_id", id),
  ]);

  const progress = progressList
    .map((r, i) => ({ group: shared[i], row: ((r.data ?? []) as MemberProgress[]).find((m) => m.user_id === id) }))
    .filter((x) => x.row);
  const checkins = (checkinsRes.data ?? []) as Checkin[];
  const habitTitle = new Map(((habitsRes.data ?? []) as Pick<Habit, "id" | "title">[]).map((h) => [h.id, h.title]));
  const counts = new Map<string, number>();
  for (const c of checkins) counts.set(c.day, (counts.get(c.day) ?? 0) + 1);

  const bookings = (bookingsRes.data ?? []) as Booking[];
  const charged = bookings.filter((b) => b.amount_due != null);
  const { data: sessionRows } = charged.length
    ? await supabase
        .from("fit_sessions")
        .select("id, starts_at, group_id")
        .in(
          "id",
          charged.map((b) => b.session_id),
        )
        .order("starts_at", { ascending: false })
    : { data: [] as { id: string; starts_at: string; group_id: string }[] };
  const sessionsById = new Map((sessionRows ?? []).map((s) => [s.id as string, s]));
  const unpaid = charged.filter((b) => !b.paid_at).reduce((s, b) => s + (b.amount_due ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Avatar name={student.display_name} id={student.id} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="display text-3xl text-ink">{student.display_name}</h1>
          <p className="text-sm text-ink-3">
            {shared.map((g) => g.name).join("、")}
            {student.phone ? (
              <>
                ・
                <a href={`tel:${student.phone}`} className="text-track">
                  {student.phone}
                </a>
              </>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href={`/messages/${student.id}`} size="sm" variant="secondary">
              傳訊息
            </ButtonLink>
            <QuickMessage kind="nudge" recipientId={student.id} recipientName={student.display_name} groupId={shared[0].id} />
          </div>
        </div>
      </div>

      {progress.map(({ group, row }) => (
        <Panel key={group.id} className="flex items-center gap-3">
          <StatusDot status={row!.status} withLabel />
          <div className="min-w-0 flex-1">
            <p className="text-ink">{progressReason(row!)}</p>
            <p className="text-sm text-ink-3">
              {shared.length > 1 ? `${group.name}・` : ""}本週 {row!.week_done}/{row!.week_target}・連續 {row!.streak} 天・近 30 天出席{" "}
              {row!.attended_30d}/{row!.counted_30d}
            </p>
          </div>
          <Link href={`/coach/groups/${group.id}`} className="shrink-0 text-sm text-track hover:underline">
            小團
          </Link>
        </Panel>
      ))}

      <Panel>
        <SectionTitle>打卡日曆</SectionTitle>
        <CheckinCalendar counts={counts} today={todayInTaipei()} />
      </Panel>

      <section>
        <SectionTitle>最近的打卡</SectionTitle>
        {checkins.length === 0 ? (
          <p className="text-sm text-ink-3">最近 10 週沒有打卡紀錄。</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {checkins.slice(0, 15).map((c) => (
              <li key={c.id} className="px-4 py-3">
                <p className="text-ink">
                  <span className="text-sm text-ink-3">{plainDateLabel(c.day)}</span>
                  <span className="ml-2">{habitTitle.get(c.habit_id) ?? "作業"}</span>
                  {c.feeling ? <span className="ml-1.5">{feelingEmoji(c.feeling)}</span> : null}
                </p>
                {c.note ? <p className="text-sm text-ink-2">「{c.note}」</p> : null}
                <ReactButtons checkinId={c.id} reaction={c.coach_reaction} comment={c.coach_comment} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Panel>
        <SectionTitle>身體數據</SectionTitle>
        <MetricsPanel metrics={(metricsRes.data ?? []) as Metric[]} userId={student.id} viewerId={user.id} />
      </Panel>

      <section>
        <SectionTitle action={unpaid > 0 ? <span className="num font-bold text-stop">未收 {money(unpaid)}</span> : null}>
          上課與費用
        </SectionTitle>
        {charged.length === 0 ? (
          <p className="text-sm text-ink-3">還沒有結算過的課。</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {charged
              .sort((a, b) => (sessionsById.get(b.session_id)?.starts_at ?? "").localeCompare(sessionsById.get(a.session_id)?.starts_at ?? ""))
              .slice(0, 12)
              .map((b) => {
                const s = sessionsById.get(b.session_id);
                return (
                  <li key={b.session_id}>
                    <Link href={`/coach/sessions/${b.session_id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                      <span>
                        <span className="text-ink">{s ? dateTimeLabel(s.starts_at) : "課程"}</span>
                        <span className="block text-sm text-ink-3">
                          {BOOKING_LABEL[b.status]}
                          {b.guests > 0 ? `・帶 ${b.guests} 位家人` : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="num block font-bold text-ink">{money(b.amount_due)}</span>
                        <span className={`text-xs ${b.paid_at ? "text-go" : "text-stop"}`}>
                          {b.paid_method ? PAID_LABEL[b.paid_method] : "未收"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}
