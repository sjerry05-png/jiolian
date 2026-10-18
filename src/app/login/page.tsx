import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app-shell";
import { getViewer } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "登入" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const mode = sp.mode === "signup" ? "signup" : "signin";

  const { user } = await getViewer();
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
          {joining ? "第一次用的話，用 Google 或 Email 註冊只要 10 秒。" : "教練和學員都從這裡登入。"}
        </p>
      </div>
      <div className="mt-8">
        <LoginForm next={next} initialError={error} initialMode={joining ? "signup" : mode} />
      </div>
    </main>
  );
}
