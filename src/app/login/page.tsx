import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app-shell";
import { getViewer } from "@/lib/auth";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "登入" };

// Supabase 後台開通 Google 登入後，按鈕會在 5 分鐘內自動出現；沒開通就不顯示，免得學員按了才出錯
async function isGoogleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      next: { revalidate: 300 },
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const mode = sp.mode === "signup" ? "signup" : "signin";

  const [{ user }, googleEnabled] = await Promise.all([getViewer(), isGoogleEnabled()]);
  if (user) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/home");

  const joining = next?.startsWith("/join/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <Link href="/" className="display flex items-center gap-2 self-start text-2xl text-ink">
        <LogoMark />
        揪練
      </Link>
      <div className="mt-10">
        <h1 className="display text-3xl leading-snug text-ink">
          {joining ? "登入後就能加入小團" : mode === "signup" ? "建立帳號" : "歡迎回來"}
        </h1>
        <p className="mt-2 text-ink-2">
          {joining
            ? `第一次用的話，用 ${googleEnabled ? "Google 或 " : ""}Email 註冊只要 10 秒。`
            : "教練和學員都從這裡登入。"}
        </p>
      </div>
      <div className="mt-8">
        <LoginForm
          next={next}
          initialError={error}
          initialMode={joining ? "signup" : mode}
          googleEnabled={googleEnabled}
        />
      </div>
    </main>
  );
}
