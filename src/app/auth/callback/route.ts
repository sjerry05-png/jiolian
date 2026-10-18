import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google 登入或 Email 驗證完成後回到這裡，用 code 換成登入狀態
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/home";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  const fail = new URL("/login", url.origin);
  fail.searchParams.set("error", "登入沒有完成，請再試一次");
  fail.searchParams.set("next", next);
  return NextResponse.redirect(fail);
}
