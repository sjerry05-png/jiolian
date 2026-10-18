import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flame } from "lucide-react";
import { progressReason, SessionRow } from "@/components/coach-bits";
import { GroupForm } from "@/components/group-form";
import { QuickMessage } from "@/components/quick-message";
import { Avatar, Empty, Panel, SectionTitle, StatusDot } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { money } from "@/lib/format";
import { getGroup, pastSessions, upcomingSessions } from "@/lib/queries";
import type { Habit, MemberProgress } from "@/lib/types";
import { ArchiveGroupButton, HabitForm, HabitItem, InvitePanel, NewSessionForm, RemoveMemberButton } from "./group-client";

export const metadata: Metadata = { title: "小團" };

const TABS = [
  { key: "members", label: "學員" },
  { key: "sessions", label: "課程" },
  { key: "habits", label: "作業" },
  { key: "settings", label: "設定" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function CoachGroupPage(props: PageProps<"/coach/groups/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "members";
  const { supabase } = await requireProfile("coach");
  const group = await getGroup(supabase, id);
  if (!group) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "jiolian.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const inviteUrl = `${proto}://${host}/join/${group.invite_code}`;

  const progressRes = await supabase.rpc("fit_group_progress", { p_group_id: id });
  const progress = (progressRes.data ?? []) as MemberProgress[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach/groups" className="text-sm text-ink-3 hover:text-track">
          小團
        </Link>
        <h1 className="display mt-0.5 text-3xl text-ink">{group.name}</h1>
        {group.archived_at ? <p className="mt-1 text-sm text-warn">已封存</p> : null}
      </div>

      {sp.created ? (
        <p className="rounded-2xl bg-go-soft px-4 py-3 text-go">小團建好了！把下面的邀請連結傳給學員，接著出作業、排課。</p>
      ) : null}

      <nav aria-label="小團分頁" className="-mx-4 flex gap-1 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/coach/groups/${id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-[15px] ${
              tab === t.key ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface"
            }`}
          >
            {t.label}
            {t.key === "members" ? <span className="num ml-1 opacity-70">{progress.length}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "members" ? (
        <MembersTab groupId={id} progress={progress} invite={!group.archived_at ? <InvitePanel group={group} url={inviteUrl} /> : null} />
      ) : null}
      {tab === "sessions" ? <SessionsTab groupId={id} group={group} /> : null}
      {tab === "habits" ? <HabitsTab groupId={id} progress={progress} /> : null}
      {tab === "settings" ? (
        <div className="space-y-8">
          <GroupForm group={group} />
          <Panel>
            <SectionTitle>封存</SectionTitle>
            <p className="-mt-1 mb-3 text-sm text-ink-2">這個家庭不練了？封存後資料都會保留，之後可以恢復。</p>
            <ArchiveGroupButton group={group} />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function MembersTab({ groupId, progress, invite }: { groupId: string; progress: MemberProgress[]; invite: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {invite}
      {progress.length === 0 ? (
        <Empty title="還沒有學員">把上面的邀請連結傳出去，加入的人會出現在這裡。</Empty>
      ) : (
        <section>
          <SectionTitle>本週進度</SectionTitle>
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {progress.map((m) => (
              <li key={m.user_id} className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <StatusDot status={m.status} />
                  <Avatar name={m.display_name} id={m.user_id} size={38} />
                  <Link href={`/coach/students/${m.user_id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{m.display_name}</p>
                    <p className="truncate text-sm text-ink-3">{progressReason(m)}</p>
                  </Link>
                  {m.status === "red" || m.status === "yellow" ? (
                    <QuickMessage kind="nudge" recipientId={m.user_id} recipientName={m.display_name} groupId={groupId} />
                  ) : (
                    <QuickMessage kind="cheer" recipientId={m.user_id} recipientName={m.display_name} groupId={groupId} />
                  )}
                </div>
                <dl className="mt-2.5 ml-[62px] grid grid-cols-4 gap-2 text-center">
                  <Stat label="本週" value={m.week_target ? `${m.week_done}/${m.week_target}` : "—"} />
                  <Stat
                    label="連續"
                    value={
                      <span className="inline-flex items-center gap-0.5">
                        {m.streak > 0 ? <Flame className="size-3.5 text-track" aria-hidden /> : null}
                        {m.streak}
                      </span>
                    }
                  />
                  <Stat label="30 天出席" value={m.counted_30d ? `${m.attended_30d}/${m.counted_30d}` : "—"} />
                  <Stat label="未收" value={m.unpaid_amount ? money(m.unpaid_amount) : "—"} warn={!!m.unpaid_amount} />
                </dl>
                <div className="mt-1 ml-[62px] text-right">
                  <RemoveMemberButton groupId={groupId} userId={m.user_id} name={m.display_name} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">紅燈：3 天以上沒打卡。黃燈：2 天沒打卡，或本週進度落後。</p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 px-1 py-1.5">
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className={`num text-[15px] font-bold ${warn ? "text-stop" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

async function SessionsTab({ groupId, group }: { groupId: string; group: NonNullable<Awaited<ReturnType<typeof getGroup>>> }) {
  const { supabase } = await requireProfile("coach");
  const [upcoming, past] = await Promise.all([
    upcomingSessions(supabase, [groupId], { includeCancelled: true }),
    pastSessions(supabase, [groupId], 20),
  ]);
  return (
    <div className="space-y-6">
      {!group.archived_at ? <NewSessionForm group={group} /> : null}
      <section>
        <SectionTitle>接下來</SectionTitle>
        {upcoming.length === 0 ? (
          <Empty title="還沒排課">排課後學員就能報名，看到即時價格。</Empty>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
            {upcoming.map((s) => (
              <SessionRow key={s.id} s={s} showGroup={false} />
            ))}
          </div>
        )}
      </section>
      {past.length > 0 ? (
        <section>
          <SectionTitle>上過的課</SectionTitle>
          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
            {past.map((s) => (
              <SessionRow key={s.id} s={s} showGroup={false} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

async function HabitsTab({ groupId, progress }: { groupId: string; progress: MemberProgress[] }) {
  const { supabase } = await requireProfile("coach");
  const { data } = await supabase
    .from("fit_habits")
    .select("id, group_id, member_id, title, detail, days_per_week, starts_on, ends_on, archived_at, created_at")
    .eq("group_id", groupId)
    .is("archived_at", null)
    .order("created_at");
  const habits = (data ?? []) as Habit[];
  const names = new Map(progress.map((p) => [p.user_id, p.display_name]));
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>進行中的作業</SectionTitle>
        {habits.length === 0 ? (
          <Empty title="還沒有作業">出幾項簡單的每週作業，學員每天打卡，你就能看出誰有在練。</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl bg-surface">
            {habits.map((h) => (
              <HabitItem key={h.id} habit={h} memberName={h.member_id ? (names.get(h.member_id) ?? "已離開的成員") : null} />
            ))}
          </ul>
        )}
      </section>
      <HabitForm groupId={groupId} members={progress.map((p) => ({ id: p.user_id, name: p.display_name }))} />
    </div>
  );
}
