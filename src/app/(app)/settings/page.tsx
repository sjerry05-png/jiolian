import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { BodyInfoForm, LargeTextToggle } from "@/components/fitness-bits";
import { Button, Panel } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import type { BodyInfo } from "@/lib/types";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "設定" };

export default async function SettingsPage() {
  const { supabase, user, profile } = await requireProfile();
  const { data: body } =
    profile.role === "student"
      ? await supabase.from("fit_body_info").select("user_id, birth_year, sex").eq("user_id", user.id).maybeSingle<BodyInfo>()
      : { data: null };
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl text-ink">設定</h1>

      <LargeTextToggle on={profile.large_text} />

      <Panel>
        <h2 className="font-medium text-ink">個人資料</h2>
        <p className="mt-0.5 text-sm text-ink-3">
          {profile.role === "coach" ? "教練" : "學員"}帳號・{user.email}
        </p>
        <div className="mt-4">
          <ProfileForm displayName={profile.display_name} phone={profile.phone ?? ""} bio={profile.bio ?? ""} role={profile.role} />
        </div>
      </Panel>

      {profile.role === "student" ? (
        <Panel>
          <h2 className="font-medium text-ink">出生年與性別</h2>
          <p className="mt-0.5 text-sm text-ink-3">體能小考跟同齡的人比較用，只有你和教練看得到。</p>
          <div className="mt-4">
            <BodyInfoForm userId={null} birthYear={body?.birth_year ?? null} sex={body?.sex ?? null} />
          </div>
        </Panel>
      ) : null}

      <Panel>
        <h2 className="font-medium text-ink">把揪練放到手機主畫面</h2>
        <ul className="mt-2 space-y-1.5 text-[0.9375rem] text-ink-2">
          <li>iPhone：用 Safari 打開，點下方「分享」→「加入主畫面」。</li>
          <li>Android：用 Chrome 打開，點右上角「⋮」→「加到主畫面」。</li>
        </ul>
        <p className="mt-2 text-sm text-ink-3">之後就能像 App 一樣從桌面直接打開。</p>
      </Panel>

      <form action={signOut}>
        <Button type="submit" variant="danger" className="w-full">
          登出
        </Button>
      </form>
    </div>
  );
}
