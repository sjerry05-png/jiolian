"use client";

import { useState } from "react";
import { sendMessage } from "@/app/actions/fit";
import { Button, ErrorText, Textarea } from "@/components/ui";
import { useAction } from "@/components/use-action";
import type { MessageKind } from "@/lib/types";

const PRESETS: Record<MessageKind, string[]> = {
  nudge: ["這週還沒看到你打卡喔，今天動 10 分鐘也好！", "作業進度落後了，需要調整強度嗎？", "明天上課前記得先把作業補上～"],
  cheer: ["加油！", "今天也一起練吧 💪", "好棒，繼續保持！"],
  chat: [],
};

/** 一鍵傳督促／加油：先選常用句，也可以自己改 */
export function QuickMessage({
  recipientId,
  recipientName,
  groupId,
  kind,
  label,
}: {
  recipientId: string;
  recipientName: string;
  groupId: string | null;
  kind: "nudge" | "cheer";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(PRESETS[kind][0]);
  const [sent, setSent] = useState(false);
  const { pending, error, run } = useAction();

  if (sent) return <span className="text-sm text-go">已傳送</span>;

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className={kind === "nudge" ? "bg-track-soft" : ""}
        onClick={() => setOpen(true)}
      >
        {label ?? (kind === "nudge" ? "督促" : "加油")}
      </Button>
    );
  }

  return (
    <>
    <div className="fixed inset-0 z-30 bg-ink/30" aria-hidden onClick={() => setOpen(false)} />
    <div
      className="fixed inset-x-0 bottom-0 z-40 space-y-3 rounded-t-3xl bg-surface p-5 pb-8 text-left shadow-[0_-8px_30px_rgba(19,33,58,0.18)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/3 sm:w-[28rem] sm:-translate-x-1/2 sm:rounded-3xl sm:pb-5"
      role="dialog"
      aria-modal="true"
      aria-label={`傳${kind === "nudge" ? "督促" : "加油"}給${recipientName}`}
    >
      <p className="font-medium text-ink">
        {kind === "nudge" ? "督促" : "幫"} {recipientName} {kind === "nudge" ? "" : "加油"}
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS[kind].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setBody(p)}
            className={`rounded-full px-3 py-1.5 text-left text-sm ${body === p ? "bg-track text-track-ink" : "bg-surface-2 text-ink-2 ring-1 ring-line"}`}
          >
            {p}
          </button>
        ))}
      </div>
      <Textarea value={body} maxLength={300} onChange={(e) => setBody(e.target.value)} className="min-h-20" />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button disabled={pending || !body.trim()} onClick={() => run(() => sendMessage(recipientId, body, kind, groupId), () => setSent(true))}>
          {pending ? "傳送中…" : "傳送"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          取消
        </Button>
      </div>
    </div>
    </>
  );
}
