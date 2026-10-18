"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

function safeNext(next: string | null | undefined): string {
  // 只允許站內路徑，避免被拿來導到外部網站
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/home";
  return next;
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInWithGoogle(next: string | null): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    return {
      ok: false,
      error: error?.message?.includes("provider is not enabled")
        ? "Google 登入還沒開通，請先用 Email 註冊"
        : "無法使用 Google 登入，請改用 Email",
    };
  }
  return { ok: true, data: data.url };
}

export async function signInWithPassword(
  email: string,
  password: string,
  next: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.code === "email_not_confirmed") return { ok: false, error: "這個帳號還沒完成 Email 驗證" };
    return { ok: false, error: "Email 或密碼不正確" };
  }
  redirect(safeNext(next));
}

export async function signUpWithPassword(
  email: string,
  password: string,
  next: string | null,
): Promise<ActionResult<"confirm_email">> {
  if (password.length < 8) return { ok: false, error: "密碼至少 8 個字元" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error) {
    if (error.code === "user_already_exists") return { ok: false, error: "這個 Email 已經註冊過了，請直接登入" };
    if (error.code === "weak_password") return { ok: false, error: "密碼太簡單，請換一個" };
    if (error.code === "over_email_send_rate_limit" || error.status === 500)
      return { ok: false, error: "目前無法寄出驗證信，請改用 Google 登入，或稍後再試" };
    return { ok: false, error: error.message };
  }
  if (!data.session) return { ok: true, data: "confirm_email" };
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
