"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteAssessment, setBodyInfo, setLargeText } from "@/app/actions/fit";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { useAction } from "@/components/use-action";

export function DeleteAssessmentButton({ id, label }: { id: string; label: string }) {
  const { pending, error, run } = useAction();
  return (
    <span className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        aria-label={`刪除 ${label} 的小考`}
        disabled={pending}
        onClick={() => {
          if (window.confirm(`確定刪除 ${label} 的小考紀錄嗎？`)) run(() => deleteAssessment(id));
        }}
        className="rounded p-1 text-ink-3 hover:text-stop"
      >
        <Trash2 className="size-4" />
      </button>
      {error ? <span className="text-xs text-stop">{error}</span> : null}
    </span>
  );
}

/** 出生年與性別（算同齡排名用）。userId 為 null 代表自己。 */
export function BodyInfoForm({
  userId,
  birthYear,
  sex,
  compact = false,
}: {
  userId: string | null;
  birthYear: number | null;
  sex: "male" | "female" | null;
  compact?: boolean;
}) {
  const [year, setYear] = useState(birthYear ? String(birthYear) : "");
  const [s, setS] = useState<"male" | "female" | null>(sex);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useAction();
  const thisYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric" }).format(new Date()));
  const age = year.length === 4 ? thisYear - Number(year) : null;

  return (
    <form
      className={compact ? "space-y-3" : "space-y-4"}
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(() => setBodyInfo(userId, year ? Number(year) : null, s), () => setSaved(true));
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`by-${userId ?? "me"}`} hint={age != null && age > 0 && age < 120 ? `約 ${age} 歲` : "西元"}>
            出生年
          </Label>
          <Input
            id={`by-${userId ?? "me"}`}
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
            placeholder="1955"
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-2">性別</legend>
          <div className="flex gap-2">
            {(
              [
                ["female", "女"],
                ["male", "男"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={s === v}
                onClick={() => setS(v)}
                className={`h-12 flex-1 rounded-xl border font-medium ${
                  s === v ? "border-track bg-track text-track-ink" : "border-line bg-surface text-ink-2"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center gap-3">
        <Button type="submit" variant={compact ? "secondary" : "primary"} disabled={pending || (!year && !s)}>
          {pending ? "儲存中…" : "儲存"}
        </Button>
        {saved && !pending ? <span className="text-sm text-go">已儲存</span> : null}
      </div>
    </form>
  );
}

/** 長輩模式開關 */
export function LargeTextToggle({ on }: { on: boolean }) {
  const [value, setValue] = useState(on);
  const { pending, error, run } = useAction();
  const toggle = () => {
    const next = !value;
    setValue(next);
    // 先在畫面上立刻套用，伺服器存好後 refresh 也會維持
    if (next) document.documentElement.dataset.size = "lg";
    else delete document.documentElement.dataset.size;
    run(
      () => setLargeText(next),
      undefined,
    );
  };
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={toggle}
        disabled={pending}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left"
      >
        <span>
          <span className="block font-medium text-ink">長輩模式（字大一點）</span>
          <span className="block text-sm text-ink-2">所有字和按鈕放大，比較好看、好按</span>
        </span>
        <span
          aria-hidden
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${value ? "bg-track" : "bg-line"}`}
        >
          <span
            className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] ${value ? "left-7" : "left-1"}`}
          />
        </span>
      </button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
