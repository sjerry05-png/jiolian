import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/config";

// 伺服器端（Server Component、Server Action、Route Handler）用的 Supabase client。
// Server Component 不能寫 cookie，所以 setAll 失敗時忽略；登入狀態由 proxy.ts 負責更新。
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 在 Server Component 裡呼叫時會到這裡，可以安全忽略
        }
      },
    },
  });
}
