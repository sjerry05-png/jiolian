import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { Button, Panel } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "設定" };

export default async function SettingsPage() {
  const { user, profile } = await requireProfile();
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl text-ink">設定</h1>

      <Panel>
        <h2 className="font-medium text-ink">個人資料</h2>
        <p className="mt-0.5 text-sm text-ink-3">
          {profile.role === "coach" ? "教練" : "學員"}帳號・{user.email}
        </p>
        <div className="mt-4">
          <ProfileForm displayName={profile.display_name} phone={profile.phone ?? ""} bio={profile.bio ?? ""} role={profile.role} />
        </div>
      </Panel>

      <Panel>
        <h2 className="font-medium text-ink">把揪練放到手機主畫面</h2>
        <ul className="mt-2 space-y-1.5 text-[15px] text-ink-2">
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
