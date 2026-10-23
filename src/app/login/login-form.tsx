"use client";

import { useState } from "react";
import { signInWithGoogle, signInWithPassword, signUpWithPassword } from "@/app/actions/auth";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { useAction } from "@/components/use-action";

export function LoginForm({
  next,
  initialError,
  initialMode,
  googleEnabled,
}: {
  next: string | null;
  initialError: string | null;
  initialMode: "signin" | "signup";
  googleEnabled: boolean;
}) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const google = useAction();
  const form = useAction();

  const onGoogle = () =>
    google.run(
      () => signInWithGoogle(next),
      (url) => {
        window.location.href = url;
      },
    );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") form.run(() => signInWithPassword(email, password, next));
    else form.run(() => signUpWithPassword(email, password, next));
  };

  return (
    <div className="space-y-6">
      <ErrorText>{google.error ?? (form.error ? null : initialError)}</ErrorText>

      {googleEnabled && (
        <>
          <Button variant="secondary" size="lg" className="w-full" onClick={onGoogle} disabled={google.pending}>
            <GoogleG />
            {google.pending ? "前往 Google…" : "用 Google 帳號繼續"}
          </Button>

          <div className="flex items-center gap-3 text-sm text-ink-3">
            <span className="h-px flex-1 bg-line" />
            或用 Email
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <Label htmlFor="password" hint={mode === "signup" ? "至少 8 個字元" : undefined}>
            密碼
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ErrorText>{form.error}</ErrorText>
        <Button type="submit" size="lg" className="w-full" disabled={form.pending || !email || !password}>
          {form.pending ? "處理中…" : mode === "signin" ? "登入" : "註冊"}
        </Button>
      </form>

      <p className="text-center text-sm text-ink-2">
        {mode === "signin" ? "還沒有帳號？" : "已經有帳號了？"}
        <button
          type="button"
          className="ml-1 font-medium text-track underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            form.setError(null);
          }}
        >
          {mode === "signin" ? "建立帳號" : "改用登入"}
        </button>
      </p>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
