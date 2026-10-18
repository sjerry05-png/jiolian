import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Empty } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { relativeLabel } from "@/lib/format";
import { coachGroups, profilesByIds, studentGroups } from "@/lib/queries";
import type { Message } from "@/lib/types";

export const metadata: Metadata = { title: "訊息" };

const KIND_LABEL = { nudge: "督促", cheer: "加油", chat: "" } as const;

export default async function Inbox() {
  const { supabase, user, profile } = await requireProfile();
  const { data } = await supabase
    .from("fit_messages")
    .select("id, group_id, sender_id, recipient_id, kind, body, read_at, created_at")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(300);
  const messages = (data ?? []) as Message[];

  // 依對象分組
  const threads = new Map<string, { last: Message; unread: number }>();
  for (const m of messages) {
    const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    const t = threads.get(other);
    const unread = m.recipient_id === user.id && !m.read_at ? 1 : 0;
    if (!t) threads.set(other, { last: m, unread });
    else t.unread += unread;
  }

  // 可以聯絡的人（還沒有對話的也列出來）
  const groups = profile.role === "coach" ? await coachGroups(supabase, user.id) : await studentGroups(supabase, user.id);
  const groupIds = groups.map((g) => g.id);
  const { data: memberRows } = groupIds.length
    ? await supabase.from("fit_group_members").select("user_id").in("group_id", groupIds).is("left_at", null)
    : { data: [] as { user_id: string }[] };
  const contactIds = new Set<string>([
    ...(memberRows ?? []).map((r) => r.user_id as string),
    ...groups.map((g) => g.coach_id),
  ]);
  contactIds.delete(user.id);
  const people = await profilesByIds(supabase, [...threads.keys(), ...contactIds]);
  const noThread = [...contactIds].filter((id) => !threads.has(id));

  return (
    <div className="space-y-6">
      <h1 className="display text-3xl text-ink">訊息</h1>

      {threads.size === 0 && noThread.length === 0 ? (
        <Empty title="還沒有訊息">
          {profile.role === "coach" ? "學員加入小團後，就能在這裡督促和回覆他們。" : "加入小團後，可以在這裡跟教練留言。"}
        </Empty>
      ) : null}

      {threads.size > 0 ? (
        <ul className="divide-y divide-line rounded-2xl bg-surface">
          {[...threads.entries()].map(([otherId, t]) => {
            const p = people.get(otherId);
            const fromMe = t.last.sender_id === user.id;
            return (
              <li key={otherId}>
                <Link href={`/messages/${otherId}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                  <Avatar name={p?.display_name ?? "?"} id={otherId} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${t.unread ? "font-bold text-ink" : "text-ink"}`}>
                        {p?.display_name ?? "已離開的成員"}
                        {p?.role === "coach" ? <span className="ml-1.5 text-xs font-normal text-track">教練</span> : null}
                      </span>
                      <span className="shrink-0 text-xs text-ink-3">{relativeLabel(t.last.created_at)}</span>
                    </div>
                    <p className={`truncate text-sm ${t.unread ? "text-ink" : "text-ink-3"}`}>
                      {fromMe ? "你：" : ""}
                      {KIND_LABEL[t.last.kind] ? `【${KIND_LABEL[t.last.kind]}】` : ""}
                      {t.last.body}
                    </p>
                  </div>
                  {t.unread ? (
                    <span className="num min-w-6 rounded-full bg-stop px-1.5 text-center text-xs leading-6 font-bold text-white">
                      {t.unread}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {noThread.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-2">開始新對話</h2>
          <div className="flex flex-wrap gap-2">
            {noThread.map((id) => {
              const p = people.get(id);
              if (!p) return null;
              return (
                <Link
                  key={id}
                  href={`/messages/${id}`}
                  className="flex items-center gap-2 rounded-full bg-surface py-1 pr-3.5 pl-1 text-sm text-ink ring-1 ring-line hover:ring-track"
                >
                  <Avatar name={p.display_name} id={id} size={28} />
                  {p.display_name}
                  {p.role === "coach" ? <span className="text-xs text-track">教練</span> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
