"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/config";
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
): Promise<ActionResult> {
  if (password.length < 8) return { ok: false, error: "密碼至少 8 個字元" };
  if (password.length > 72) return { ok: false, error: "密碼最多 72 個字元" };

  // 註冊走 Supabase Edge Function（jiolian-signup）：直接建立已驗證帳號，不用等驗證信。
  // 這樣不必關掉整個 Supabase 專案的「Confirm email」，同專案的其他 App 不受影響。
  const h = await headers();
  const clientIp = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim();
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/jiolian-signup`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "x-client-ip": clientIp,
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch {
    return { ok: false, error: "連線不穩，請稍後再試" };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    switch (body.error) {
      case "user_already_exists":
        return { ok: false, error: "這個 Email 已經註冊過了，請直接登入" };
      case "invalid_email":
        return { ok: false, error: "Email 格式不正確" };
      case "weak_password":
        return { ok: false, error: "密碼太簡單，請換一個" };
      case "rate_limited":
        return { ok: false, error: "註冊的人有點多，請過幾分鐘再試" };
      default:
        return { ok: false, error: "目前無法註冊，請稍後再試" };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: "帳號已建立，請改用登入" };
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
