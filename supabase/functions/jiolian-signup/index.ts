// 揪練 JioFit 註冊：建立已驗證的 Email 帳號（不寄驗證信），只影響揪練，不改整個 Supabase 專案的驗證設定。
// 呼叫端：Next.js 伺服器的 signUpWithPassword。限流在資料庫的 fit_signup_gate。
// 部署時 verify_jwt = false（publishable key 不是 JWT）。
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: "weak_password" }, 400);

  const ip = (req.headers.get("x-client-ip") ?? req.headers.get("x-forwarded-for") ?? "")
    .split(",")[0]
    .trim();
  const gate = await admin.rpc("fit_signup_gate", { p_ip: ip });
  if (gate.error) return json({ error: "server_error" }, 500);
  if (gate.data !== true) return json({ error: "rate_limited" }, 429);

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { signup_app: "jiolian" },
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "email_exists" || code === "user_already_exists" || /already/i.test(error.message)) {
      return json({ error: "user_already_exists" }, 409);
    }
    if (code === "weak_password") return json({ error: "weak_password" }, 400);
    console.error("createUser failed", code, error.message);
    return json({ error: "server_error" }, 500);
  }
  return json({ ok: true });
});
