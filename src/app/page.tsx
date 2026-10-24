import Link from "next/link";
import { LogoMark } from "@/components/app-shell";
import { ButtonLink, StatusDot } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { DemoStairs } from "./demo-stairs";

export default async function Landing() {
  const { user } = await getViewer();

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <span className="display flex items-center gap-2 text-2xl text-ink">
          <LogoMark />
          揪練
        </span>
        <ButtonLink href={user ? "/home" : "/login"} variant="secondary" size="sm">
          {user ? "進入揪練" : "登入"}
        </ButtonLink>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pt-8 pb-16 md:grid-cols-[1.05fr_1fr] md:pt-16">
          <div>
            <h1 className="display text-[2.75rem] leading-[1.15] text-ink sm:text-6xl">
              揪越多人，
              <br />
              每人越便宜。
            </h1>
            <p className="mt-5 max-w-[30em] text-lg leading-relaxed text-ink-2">
              教練帶一家人或一群朋友組小團，在家、公園或健身房上課。每堂人數可以不一樣，價格自動算；下課後，教練還會盯著你練。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href={user ? "/home" : "/login?mode=signup&next=%2Fonboarding%3Frole%3Dcoach"} size="lg">
                我是教練，開一個小團
              </ButtonLink>
              <p className="text-sm text-ink-3">學員請直接打開教練傳給你的邀請連結。</p>
            </div>
          </div>
          <DemoStairs />
        </section>

        <section className="bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-16">
            <h2 className="display text-3xl text-ink">人數變來變去，也算得公平</h2>
            <p className="mt-3 max-w-[36em] text-ink-2">
              每堂課有一個取消期限（預設上課前 12 小時）。期限前取消不用付錢；過了期限才取消照樣算錢，其他人的價格不會因為有人臨時退出而變貴。過了期限還是可以加人，大家只會更便宜。
            </p>
            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {[
                { t: "報名", d: "家人朋友在 App 按「要來」，爸爸可以幫小孩一起報。價格隨人數即時往下掉。" },
                { t: "取消期限", d: "時間一到人數就鎖定。之後只能加人，不能減人。" },
                { t: "下課結算", d: "教練按結算，系統算好每個人要付多少，收到錢再勾選。" },
              ].map((s, i) => (
                <li key={s.t} className="relative border-t-4 border-track pt-4">
                  <span className="num text-sm font-bold text-track">第 {i + 1} 步</span>
                  <p className="display mt-1 text-xl text-ink">{s.t}</p>
                  <p className="mt-1.5 text-[0.9375rem] text-ink-2">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="display text-3xl text-ink">被盯著，才練得下去</h2>
            <p className="mt-3 max-w-[32em] text-ink-2">
              教練出每週作業，學員每天打卡、選心情。教練看板用紅黃綠燈標出誰三天沒動、誰進度落後，一鍵傳督促。同一團的家人也看得到彼此的打卡和本週排行。
            </p>
          </div>
          <div className="rounded-3xl bg-surface p-2" aria-label="教練看板示意">
            {[
              { n: "阿姨", s: "red" as const, d: "5 天沒打卡", w: "0/4" },
              { n: "林媽", s: "yellow" as const, d: "本週落後", w: "1/4" },
              { n: "林爸", s: "green" as const, d: "連續 6 天", w: "9/11" },
            ].map((r) => (
              <div key={r.n} className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-0">
                <StatusDot status={r.s} />
                <span className="w-14 font-medium text-ink">{r.n}</span>
                <span className="flex-1 text-sm text-ink-2">{r.d}</span>
                <span className="num text-ink">{r.w}</span>
                <span
                  className={`rounded-lg px-2.5 py-1 text-sm ${r.s === "green" ? "text-ink-3" : "bg-track-soft font-medium text-track"}`}
                >
                  {r.s === "green" ? "加油" : "督促"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface">
          <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center">
            <div className="md:order-2">
              <h2 className="display text-3xl text-ink">帶爸媽一起練，進步看得見</h2>
              <p className="mt-3 max-w-[32em] text-ink-2">
                長輩練的不是肌肉線條，是站得起來、走得穩、提得動。揪練把這些變成看得到的數字，讓長輩和家人都感覺到「真的有在變好」。
              </p>
              <ul className="mt-6 space-y-4">
                {[
                  {
                    t: "每月體能小考",
                    d: "跟體育署 65 歲以上檢測同樣的項目，教練帶著測約 15 分鐘。和第一次比、也和台灣同齡長者比，測前先做安全檢查。",
                  },
                  {
                    t: "生活目標",
                    d: "自己挑幾件現在覺得吃力的事，像是不扶扶手爬到 3 樓、蹲下撿東西。做到那天，家人會在家族動態幫忙歡呼。",
                  },
                  {
                    t: "每週身體感受",
                    d: "疼痛、睡眠、精神，10 秒填完。哪裡痛變多了，教練上課前就會知道。設定裡還有長輩模式，字和按鈕都放大。",
                  },
                ].map((f) => (
                  <li key={f.t} className="border-l-4 border-lane pl-4">
                    <p className="display text-lg text-ink">{f.t}</p>
                    <p className="mt-1 text-[0.9375rem] text-ink-2">{f.d}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 md:order-1" aria-label="長輩成績單示意">
              <div className="rounded-3xl bg-go-soft p-5">
                <p className="text-sm text-go">跟第一次比，第 2 次小考</p>
                <p className="display mt-1 text-2xl text-ink">
                  有 <span className="num text-go">4</span> 項明顯進步
                </p>
              </div>
              {[
                { name: "30 秒椅子坐立", short: "腿力", v: "13", unit: "次", delta: "多 3 次", life: "從沙發、馬桶站起來不用扶" },
                { name: "開眼單足立", short: "靜態平衡", v: "15", unit: "秒", delta: "多站 7 秒", life: "站著穿褲子、上下公車" },
              ].map((t) => (
                <div key={t.name} className="rounded-3xl bg-bg p-5">
                  <p className="text-sm text-ink-3">{t.name}</p>
                  <p className="display text-lg text-ink">{t.short}</p>
                  <p className="mt-1 text-ink">
                    <span className="num text-4xl font-bold">{t.v}</span> <span className="text-ink-2">{t.unit}</span>
                  </p>
                  <p className="mt-1 font-medium text-go">↗ {t.delta}・明顯進步</p>
                  <p className="mt-1 text-sm text-ink-2">👉 {t.life}</p>
                </div>
              ))}
              <div className="flex items-center gap-3 rounded-3xl bg-lane-soft px-5 py-4">
                <span className="text-2xl" aria-hidden>
                  🎉
                </span>
                <p className="text-ink">
                  <span className="font-medium">阿嬤</span> 做到了「蹲下撿東西不用扶」
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 text-sm text-ink-3 sm:flex-row sm:justify-between">
          <span>揪練：給小團教練的排課、計價與盯梢工具</span>
          <Link href="/login" className="text-track hover:underline">
            登入
          </Link>
        </div>
      </footer>
    </div>
  );
}
