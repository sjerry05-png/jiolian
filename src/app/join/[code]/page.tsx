import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/app-shell";
import { PriceStairs } from "@/components/price-stairs";
import { ButtonLink, Panel } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { LOCATION_LABEL, money } from "@/lib/format";
import type { GroupPreview } from "@/lib/types";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "加入小團" };

export default async function JoinPage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;
  const { supabase, user, profile } = await getViewer();
  const { data } = await supabase.rpc("fit_group_preview", { p_code: code });
  const group = (data as GroupPreview[] | null)?.[0] ?? null;
  const selfPath = `/join/${code}`;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-8">
      <Link href="/" className="display flex items-center gap-2 text-2xl text-ink">
        <LogoMark />
        揪練
      </Link>

      {!group ? (
        <div className="mt-12">
          <h1 className="display text-3xl text-ink">找不到這個小團</h1>
          <p className="mt-2 text-ink-2">邀請連結可能打錯了，或教練已經換了新連結。請跟教練要一次新的連結。</p>
        </div>
      ) : (
        <>
          <p className="mt-10 text-ink-2">{group.coach_name} 邀請你加入</p>
          <h1 className="display mt-1 text-4xl leading-tight text-ink">{group.name}</h1>
          {group.description ? <p className="mt-3 text-ink-2">{group.description}</p> : null}
          <p className="mt-3 text-sm text-ink-3">
            目前 {group.member_count} 位成員・通常在{LOCATION_LABEL[group.default_location_type]}
            {group.default_location ? `（${group.default_location}）` : ""}上課
          </p>

          <Panel className="mt-6">
            <p className="font-medium text-ink">一起上課的人越多，每人越便宜</p>
            <p className="mt-1 text-sm text-ink-2">
              一個人上課每人 {money(group.price_ladder[0])}
              {group.price_ladder.length > 1
                ? `，${group.price_ladder.length} 人一起上只要每人 ${money(group.price_ladder[group.price_ladder.length - 1])}`
                : ""}
              。每堂課依實際報名人數計價。
            </p>
            <div className="mt-5">
              <PriceStairs ladder={group.price_ladder} headcount={Math.min(group.member_count, group.price_ladder.length)} />
            </div>
          </Panel>

          <div className="mt-8">
            {group.is_archived ? (
              <p className="rounded-xl bg-warn-soft px-4 py-3 text-warn">這個小團已經停止招生。</p>
            ) : !user ? (
              <ButtonLink href={`/login?next=${encodeURIComponent(selfPath)}`} size="lg" className="w-full">
                登入並加入
              </ButtonLink>
            ) : !profile ? (
              <ButtonLink href={`/onboarding?next=${encodeURIComponent(selfPath)}`} size="lg" className="w-full">
                填好名字並加入
              </ButtonLink>
            ) : group.is_member ? (
              <ButtonLink href="/me" size="lg" className="w-full">
                你已經在這個小團了，去今天的作業
              </ButtonLink>
            ) : profile.role === "coach" ? (
              <p className="rounded-xl bg-surface px-4 py-3 text-ink-2">
                你現在用的是教練帳號，學員帳號才能加入小團。請換一個 Google 帳號或 Email 註冊學員帳號。
              </p>
            ) : (
              <JoinButton code={code} name={profile.display_name} />
            )}
          </div>
        </>
      )}
    </main>
  );
}
