"use client";

import { useState } from "react";
import { setupProfile } from "@/app/actions/fit";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { useAction } from "@/components/use-action";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; title: string; body: string }[] = [
  { value: "coach", title: "我是教練", body: "開小團、排課、出作業，看誰沒在練" },
  { value: "student", title: "我是學員", body: "打卡、報名上課，跟家人一起練" },
];

export function OnboardingForm({
  next,
  lockedRole,
  initialRole,
  suggestedName,
}: {
  next: string | null;
  lockedRole: Role | null;
  initialRole: Role | null;
  suggestedName: string;
}) {
  const [name, setName] = useState(suggestedName);
  const [role, setRole] = useState<Role | null>(lockedRole ?? initialRole);
  const { pending, error, run } = useAction();

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (role) run(() => setupProfile(name, role, next));
      }}
    >
      <div>
        <Label htmlFor="name" hint="1～30 個字">
          你的名字
        </Label>
        <Input
          id="name"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          placeholder={role === "coach" ? "例如：王教練" : "例如：林爸"}
          autoComplete="nickname"
        />
      </div>

      {lockedRole ? null : (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-2">你的身分</legend>
          <div className="grid gap-3">
            {ROLES.map((r) => {
              const checked = role === r.value;
              return (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-surface p-4 transition-colors ${
                    checked ? "border-track" : "border-transparent hover:border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={checked}
                    onChange={() => setRole(r.value)}
                    className="mt-1.5 size-4 accent-[var(--track)]"
                  />
                  <span>
                    <span className="display block text-xl text-ink">{r.title}</span>
                    <span className="mt-0.5 block text-sm text-ink-2">{r.body}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" disabled={pending || !role || !name.trim()}>
        {pending ? "儲存中…" : lockedRole ? "完成，加入小團" : "開始使用"}
      </Button>
    </form>
  );
}
