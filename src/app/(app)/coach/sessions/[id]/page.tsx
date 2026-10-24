import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Lock, MapPin } from "lucide-react";
import { PriceStairs } from "@/components/price-stairs";
import { Panel, SectionTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { dateTimeLabel, LOCATION_LABEL, money } from "@/lib/format";
import { activeMembers, bookingsForSessions, getSession, profilesByIds } from "@/lib/queries";
import { RosterRow, SessionAdmin, SessionNote, SettleButton } from "./session-client";

export const metadata: Metadata = { title: "課程" };

export default async function CoachSessionPage(props: PageProps<"/coach/sessions/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireProfile("coach");
  const session = await getSession(supabase, id);
  if (!session) notFound();

  const [bookings, members] = await Promise.all([bookingsForSessions(supabase, [id]), activeMembers(supabase, session.group_id)]);
  const userIds = Array.from(new Set([...members.map((m) => m.user_id), ...bookings.map((b) => b.user_id)]));
  const people = await profilesByIds(supabase, userIds);
  const bookingOf = (uid: string) => bookings.find((b) => b.user_id === uid) ?? null;
  const order = ["attended", "going", "no_show", "late_cancel", "declined"];
  const sortedIds = userIds.sort((a, b) => {
    const ia = bookingOf(a) ? order.indexOf(bookingOf(a)!.status) : 9;
    const ib = bookingOf(b) ? order.indexOf(bookingOf(b)!.status) : 9;
    return ia - ib;
  });

  const started = session.has_started;
  const hasPayments = bookings.some((b) => b.paid_at);
  const billed = bookings.reduce((s, b) => s + (b.paid_method === "waived" ? 0 : (b.amount_due ?? 0)), 0);
  const collected = bookings.reduce((s, b) => s + (b.paid_at && b.paid_method !== "waived" ? (b.amount_due ?? 0) : 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/coach/groups/${session.group_id}?tab=sessions`} className="text-sm text-ink-3 hover:text-track">
          {session.group_name}
        </Link>
        <h1 className="display mt-0.5 text-3xl text-ink">{dateTimeLabel(session.starts_at)}</h1>
        <div className="mt-2 space-y-1 text-[0.9375rem] text-ink-2">
          {session.title ? <p className="font-medium text-ink">{session.title}</p> : null}
          <p className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            {LOCATION_LABEL[session.location_type]}
            {session.location ? `・${session.location}` : ""}・{session.duration_min} 分鐘
          </p>
          {session.status === "scheduled" ? (
            <p className={`flex items-center gap-1.5 ${session.is_locked ? "text-warn" : ""}`}>
              {session.is_locked ? <Lock className="size-4" aria-hidden /> : <Clock className="size-4" aria-hidden />}
              {session.is_locked ? "已過取消期限，人數只增不減" : `${dateTimeLabel(session.lock_at)} 前學員可免費取消`}
            </p>
          ) : null}
        </div>
        {session.status === "cancelled" ? <p className="mt-3 rounded-xl bg-surface px-4 py-3 text-ink-2">這堂課已取消。</p> : null}
      </div>

      {session.status !== "cancelled" ? (
        <Panel>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-ink-3">{session.status === "completed" ? "實際上課" : "目前報名"}</p>
              <p className="num text-4xl font-bold text-ink">
                {session.headcount}
                <span className="text-lg font-normal text-ink-3"> / {session.capacity} 人</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-ink-3">每人 {money(session.price_now)}</p>
              {session.status === "completed" ? (
                <p className="num text-2xl font-bold text-track">
                  已收 {money(collected)}
                  <span className="text-base font-normal text-ink-3"> / {money(billed)}</span>
                </p>
              ) : (
                <p className="num text-2xl font-bold text-track">這堂 {money(session.price_now * session.headcount)}</p>
              )}
            </div>
          </div>
          <PriceStairs ladder={session.price_ladder} headcount={session.headcount} showCoachTotal />
        </Panel>
      ) : null}

      {session.status === "scheduled" && started ? <SettleButton session={session} /> : null}

      <section>
        <SectionTitle>{session.status === "completed" ? "點名與收款" : "誰會來"}</SectionTitle>
        {hasPayments && session.status === "completed" ? (
          <p className="-mt-1 mb-2 text-sm text-ink-3">已經有收款紀錄，要改點名請先把收款改回「未收」。</p>
        ) : null}
        {sortedIds.length === 0 ? (
          <p className="text-sm text-ink-3">這個小團還沒有學員。</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {sortedIds.map((uid) => (
              <RosterRow
                key={uid}
                session={session}
                userId={uid}
                name={people.get(uid)?.display_name ?? "已離開的成員"}
                booking={bookingOf(uid)}
                hasPayments={hasPayments}
              />
            ))}
          </ul>
        )}
      </section>

      <Panel>
        <SessionNote sessionId={session.id} note={session.coach_note} />
      </Panel>

      {session.status === "scheduled" && !started ? <SessionAdmin session={session} /> : null}
    </div>
  );
}
