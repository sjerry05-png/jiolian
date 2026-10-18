import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Avatar } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { dateTimeLabel } from "@/lib/format";
import type { Message, MessageKind, Profile } from "@/lib/types";
import { Composer, MarkRead } from "./thread-client";

export const metadata: Metadata = { title: "訊息" };

const KIND_TAG: Record<MessageKind, string | null> = { nudge: "督促", cheer: "加油", chat: null };

export default async function Thread(props: PageProps<"/messages/[userId]">) {
  const { userId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  const { supabase, user, profile } = await requireProfile();
  const { data: other } = await supabase
    .from("fit_profiles")
    .select("id, display_name, role, phone, bio")
    .eq("id", userId)
    .maybeSingle<Profile>();
  if (!other || other.id === user.id) notFound();

  const { data } = await supabase
    .from("fit_messages")
    .select("id, group_id, sender_id, recipient_id, kind, body, read_at, created_at")
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
    .order("created_at", { ascending: true })
    .limit(200);
  const messages = (data ?? []) as Message[];
  const hasUnread = messages.some((m) => m.recipient_id === user.id && !m.read_at);

  const kinds: MessageKind[] =
    profile.role === "coach" && other.role === "student"
      ? ["chat", "nudge", "cheer"]
      : profile.role === "student" && other.role === "coach"
        ? ["chat"]
        : ["cheer"];

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      {hasUnread ? <MarkRead senderId={userId} /> : null}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/messages" aria-label="回訊息列表" className="-ml-2 rounded-lg p-2 text-ink-2 hover:bg-track-soft">
          <ChevronLeft className="size-5" />
        </Link>
        <Avatar name={other.display_name} id={other.id} size={40} />
        <div>
          <h1 className="display text-xl text-ink">{other.display_name}</h1>
          <p className="text-xs text-ink-3">
            {other.role === "coach" ? "教練" : "學員"}
            {other.phone ? `・${other.phone}` : ""}
          </p>
        </div>
        {profile.role === "coach" && other.role === "student" ? (
          <Link href={`/coach/students/${other.id}`} className="ml-auto text-sm text-track hover:underline">
            看進度
          </Link>
        ) : null}
      </div>

      <ol className="flex-1 space-y-3">
        {messages.length === 0 ? (
          <li className="py-8 text-center text-sm text-ink-3">還沒有訊息，打個招呼吧。</li>
        ) : null}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          const tag = KIND_TAG[m.kind];
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
                    m.kind === "nudge"
                      ? "bg-lane text-lane-ink"
                      : mine
                        ? "rounded-br-sm bg-track text-track-ink"
                        : "rounded-bl-sm bg-surface text-ink"
                  }`}
                >
                  {tag ? <span className="mr-1.5 text-xs font-bold">【{tag}】</span> : null}
                  {m.body}
                </div>
                <span className="mt-1 text-[11px] text-ink-3">
                  {dateTimeLabel(m.created_at)}
                  {mine && m.read_at ? "・已讀" : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-20 mt-4 md:bottom-4">
        <Composer recipientId={other.id} kinds={kinds} />
      </div>
    </div>
  );
}
