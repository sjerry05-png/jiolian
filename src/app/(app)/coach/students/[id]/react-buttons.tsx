"use client";

import { useState } from "react";
import { reactCheckin } from "@/app/actions/fit";
import { useAction } from "@/components/use-action";

const REACTIONS = ["👍", "🔥", "💪", "👏"];

export function ReactButtons({
  checkinId,
  reaction,
  comment,
}: {
  checkinId: string;
  reaction: string | null;
  comment: string | null;
}) {
  const [text, setText] = useState(comment ?? "");
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAction();

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {REACTIONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={pending}
            aria-pressed={reaction === r}
            aria-label={`回應 ${r}`}
            onClick={() => run(() => reactCheckin(checkinId, reaction === r ? null : r, text))}
            className={`flex size-8 items-center justify-center rounded-full text-base ${
              reaction === r ? "bg-lane ring-2 ring-lane" : "bg-surface-2 opacity-70 hover:opacity-100"
            }`}
          >
            {r}
          </button>
        ))}
        <button type="button" onClick={() => setOpen((v) => !v)} className="ml-1 text-sm text-track hover:underline">
          {comment ? "改留言" : "留一句話"}
        </button>
      </div>
      {open ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => reactCheckin(checkinId, reaction ?? "👍", text), () => setOpen(false));
          }}
        >
          <input
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：動作很標準！"
            aria-label="給學員的一句話"
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-[1rem] focus:border-track focus:outline-none"
          />
          <button type="submit" disabled={pending} className="h-10 rounded-lg bg-track px-3 text-sm font-medium text-track-ink">
            送出
          </button>
        </form>
      ) : null}
      {error ? <p className="mt-1 text-sm text-stop">{error}</p> : null}
    </div>
  );
}
