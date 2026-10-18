"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { markRead, sendMessage } from "@/app/actions/fit";
import { useAction } from "@/components/use-action";
import type { MessageKind } from "@/lib/types";

const KIND_LABEL: Record<MessageKind, string> = { chat: "留言", nudge: "督促", cheer: "加油" };

export function MarkRead({ senderId }: { senderId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markRead(senderId);
  }, [senderId]);
  return null;
}

export function Composer({ recipientId, kinds }: { recipientId: string; kinds: MessageKind[] }) {
  const [kind, setKind] = useState<MessageKind>(kinds[0]);
  const [body, setBody] = useState("");
  const { pending, error, run } = useAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    run(() => sendMessage(recipientId, body, kind, null), () => setBody(""));
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-surface p-2 shadow-[0_0_0_1px_var(--line)]">
      {kinds.length > 1 ? (
        <div className="mb-2 flex gap-1 px-1 pt-1" role="radiogroup" aria-label="訊息類型">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1 text-sm ${
                kind === k ? (k === "nudge" ? "bg-lane text-lane-ink" : "bg-track text-track-ink") : "text-ink-2 hover:bg-track-soft"
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor="composer" className="sr-only">
          訊息內容
        </label>
        <textarea
          id="composer"
          rows={1}
          value={body}
          maxLength={300}
          onChange={(e) => setBody(e.target.value)}
          placeholder={kind === "cheer" ? "幫對方加油…" : kind === "nudge" ? "提醒學員回來練…" : "輸入訊息…"}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl bg-surface-2 px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-track/30"
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          aria-label="傳送"
          className="flex size-11 items-center justify-center rounded-xl bg-track text-track-ink disabled:opacity-40"
        >
          <Send className="size-5" />
        </button>
      </div>
      {error ? <p className="px-2 pt-2 text-sm text-stop">{error}</p> : null}
    </form>
  );
}
