import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

/** 目前登入的使用者與他的揪練個人資料（同一次 request 只查一次） */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase
    .from("fit_profiles")
    .select("id, display_name, role, phone, bio, large_text")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  return { supabase, user, profile };
});

/** 頁面用：沒登入去登入頁、沒個人資料去 onboarding、身分不符導回自己的首頁 */
export async function requireProfile(role?: Role, nextPath?: string) {
  const viewer = await getViewer();
  if (!viewer.user) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  if (!viewer.profile) redirect(`/onboarding${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  if (role && viewer.profile.role !== role) redirect(homePathFor(viewer.profile.role));
  return { supabase: viewer.supabase, user: viewer.user, profile: viewer.profile };
}

export function homePathFor(role: Role) {
  return role === "coach" ? "/coach" : "/me";
}
