import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LaneBoard } from "@/components/lane-board";
import { PriceStairs } from "@/components/price-stairs";
import { QuickMessage } from "@/components/quick-message";
import { Avatar, ButtonLink, Panel, SectionTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { feelingEmoji, LOCATION_LABEL, money, relativeLabel } from "@/lib/format";
import { getGroup, profilesByIds } from "@/lib/queries";
import type { Checkin, Habit, MemberProgress } from "@/lib/types";
import { LeaveGroupButton } from "./leave-button";

export const metadata: Metadata = { title: "小團" };

export default async function StudentGroupPage(props: PageProps<"/me/groups/[id]">) {
  const { id } = await props.params;
  const { supabase, user } = await requireProfile("student");
  const group = await getGroup(supabase, id);
  if (!group) notFound();

  const [progressRes, feedRes, habitsRes] = await Promise.all([
    supabase.rpc("fit_group_progress", { p_group_id: id }),
    supabase
      .from("fit_checkins")
      .select("id, habit_id, group_id, user_id, day, feeling, note, coach_reaction, coach_comment, created_at")
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("fit_habits").select("id, title, member_id, days_per_week").eq("group_id", id),
  ]);
  const progress = (progressRes.data ?? []) as MemberProgress[];
  const feed = (feedRes.data ?? []) as Checkin[];
  const habits = new Map(((habitsRes.data ?? []) as Habit[]).map((h) => [h.id, h]));
  const people = await profilesByIds(supabase, [group.coach_id, ...progress.map((p) => p.user_id), ...feed.map((f) => f.user_id)]);
  const coach = people.get(group.coach_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl text-ink">{group.name}</h1>
        <p className="mt-1 text-ink-2">
          教練 {coach?.display_name}・{progress.length} 位成員・通常在{LOCATION_LABEL[group.default_location_type]}
          {group.default_location ? `（${group.default_location}）` : ""}
        </p>
        <div className="mt-3 flex gap-2">
          <ButtonLink href={`/messages/${group.coach_id}`} variant="secondary" size="sm">
            留言給教練
          </ButtonLink>
        </div>
      </div>

      <Panel>
        <SectionTitle>本週排行</SectionTitle>
        <LaneBoard
          members={progress}
          meId={user.id}
          renderAction={(m) =>
            m.user_id === user.id ? null : (
              <QuickMessage kind="cheer" recipientId={m.user_id} recipientName={m.display_name} groupId={id} />
            )
          }
        />
      </Panel>

      <section>
        <SectionTitle>大家的打卡</SectionTitle>
        {feed.length === 0 ? (
          <p className="text-sm text-ink-3">還沒有人打卡，當第一個吧！</p>
        ) : (
          <ul className="space-y-3">
            {feed.map((c) => {
              const who = people.get(c.user_id);
              return (
                <li key={c.id} className="flex gap-3">
                  <Avatar name={who?.display_name ?? "?"} id={c.user_id} size={34} />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2.5">
                    <p className="text-[15px] text-ink">
                      <span className="font-medium">{c.user_id === user.id ? "你" : who?.display_name}</span> 完成了「
                      {habits.get(c.habit_id)?.title ?? "作業"}」
                      {c.feeling ? <span className="ml-1">{feelingEmoji(c.feeling)}</span> : null}
                    </p>
                    {c.note ? <p className="mt-0.5 text-sm text-ink-2">{c.note}</p> : null}
                    {c.coach_reaction || c.coach_comment ? (
                      <p className="mt-1 text-sm text-track">
                        {c.coach_reaction} 教練：{c.coach_comment ?? "按讚"}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-ink-3">{relativeLabel(c.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Panel>
        <SectionTitle>這團的價目</SectionTitle>
        <p className="-mt-1 mb-4 text-sm text-ink-2">
          每堂課依實際人數計價，一個人上 {money(group.price_ladder[0])}，人越多每人越便宜。上課前 {group.lock_hours}{" "}
          小時後取消仍需付費。
        </p>
        <PriceStairs ladder={group.price_ladder} headcount={0} />
      </Panel>

      <div className="flex items-center justify-between border-t border-line pt-5">
        <Link href="/me/sessions" className="text-sm text-track hover:underline">
          看這團的課程
        </Link>
        <LeaveGroupButton groupId={id} groupName={group.name} />
      </div>
    </div>
  );
}
