import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { CheckinCalendar } from "@/components/checkin-calendar";
import { BodyInfoForm } from "@/components/fitness-bits";
import { FitnessReport } from "@/components/fitness-report";
import { GoalsPanel } from "@/components/goals-panel";
import { MetricsPanel } from "@/components/metrics-panel";
import { buttonClass, Empty, Panel, SectionTitle } from "@/components/ui";
import { WellbeingTrend } from "@/components/wellbeing-trend";
import { requireProfile } from "@/lib/auth";
import { taipeiDateDaysAgo, todayInTaipei } from "@/lib/format";
import { profilesByIds, seniorData } from "@/lib/queries";
import type { Metric, MySummary } from "@/lib/types";

export const metadata: Metadata = { title: "進度" };

export default async function StudentProgress(props: PageProps<"/me/progress">) {
  const sp = await props.searchParams;
  const assessedId = typeof sp.assessed === "string" ? sp.assessed : null;
  const { supabase, user } = await requireProfile("student");
  const today = todayInTaipei();
  const since = taipeiDateDaysAgo(80);

  const [checkinsRes, metricsRes, summaryRes, senior] = await Promise.all([
    supabase.from("fit_checkins").select("day").eq("user_id", user.id).gte("day", since),
    supabase
      .from("fit_metrics")
      .select("id, user_id, measured_on, weight_kg, body_fat_pct, waist_cm, note, recorded_by, created_at")
      .eq("user_id", user.id)
      .order("measured_on"),
    supabase.rpc("fit_my_summary"),
    seniorData(supabase, user.id),
  ]);

  const counts = new Map<string, number>();
  for (const c of (checkinsRes.data ?? []) as { day: string }[]) counts.set(c.day, (counts.get(c.day) ?? 0) + 1);
  const summary = summaryRes.data as MySummary | null;
  const recorders = await profilesByIds(
    supabase,
    senior.assessments.map((a) => a.recorded_by).filter((x): x is string => Boolean(x)),
  );
  const names = new Map([...recorders].map(([id, p]) => [id, p.display_name]));
  const metrics = (metricsRes.data ?? []) as Metric[];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="display text-3xl text-ink">進度</h1>
        <dl className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-surface px-4 py-3">
            <dt className="text-xs text-ink-3">連續打卡</dt>
            <dd className="num text-3xl font-bold text-track">
              {summary?.streak ?? 0}
              <span className="ml-0.5 text-base font-normal text-ink-2">天</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-surface px-4 py-3">
            <dt className="text-xs text-ink-3">本週完成</dt>
            <dd className="num text-3xl font-bold text-ink">
              {summary?.week_done ?? 0}
              <span className="text-base font-normal text-ink-2">/{summary?.week_target ?? 0}</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-surface px-4 py-3">
            <dt className="text-xs text-ink-3">近 10 週</dt>
            <dd className="num text-3xl font-bold text-ink">
              {counts.size}
              <span className="ml-0.5 text-base font-normal text-ink-2">天</span>
            </dd>
          </div>
        </dl>
      </div>

      <section id="fitness" className="scroll-mt-20">
        <SectionTitle
          action={
            <Link href="/me/assess" className={buttonClass("secondary", "sm")}>
              <ClipboardList className="size-4" aria-hidden />
              自己測一次
            </Link>
          }
        >
          體能小考
        </SectionTitle>
        {assessedId ? <p className="mb-3 rounded-2xl bg-go-soft px-4 py-3 text-go">存好了！下面是跟之前的比較。</p> : null}
        {senior.assessments.length === 0 ? (
          <Empty title="還沒做過體能小考">
            請教練上課時幫你測一次，或跟家人在家自己測。之後每 4～6 週再測，就看得到腿力、平衡、柔軟度有沒有變好。
          </Empty>
        ) : (
          <FitnessReport
            assessments={senior.assessments}
            body={senior.body}
            today={today}
            highlightId={assessedId}
            names={names}
            canDelete={false}
          />
        )}
        {!senior.body?.sex || !senior.body?.birth_year ? (
          <Panel className="mt-3">
            <p className="font-medium text-ink">填出生年和性別，看看跟同齡的人比起來如何</p>
            <p className="mt-0.5 mb-3 text-sm text-ink-2">只有你和教練看得到。</p>
            <BodyInfoForm userId={null} birthYear={senior.body?.birth_year ?? null} sex={senior.body?.sex ?? null} compact />
          </Panel>
        ) : null}
      </section>

      <section id="goals" className="scroll-mt-20">
        <SectionTitle>生活目標</SectionTitle>
        <p className="-mt-1 mb-3 text-sm text-ink-2">
          挑 3～5 件現在覺得吃力的事，每個月重新打一次分數（0 做不到、10 很輕鬆）。做到了按「做到了！」，家人會幫你歡呼。
        </p>
        <GoalsPanel goals={senior.goals} ratings={senior.ratings} userId={null} today={today} isSelf />
      </section>

      <section>
        <SectionTitle
          action={
            <Link href="/me#wellbeing" className="text-sm text-track hover:underline">
              填這週
            </Link>
          }
        >
          身體感受
        </SectionTitle>
        <Panel>
          <WellbeingTrend weeks={senior.wellbeing} emptyText="每週在「今天」頁面填一次，這裡就會看到疼痛、睡眠、精神的變化。" />
        </Panel>
      </section>

      <Panel>
        <SectionTitle>打卡日曆</SectionTitle>
        <CheckinCalendar counts={counts} today={today} />
      </Panel>

      <Panel>
        <SectionTitle>身體數據</SectionTitle>
        <p className="-mt-1 mb-4 text-sm text-ink-2">只有你和你的教練看得到。</p>
        <MetricsPanel metrics={metrics} userId={null} viewerId={user.id} />
      </Panel>
    </div>
  );
}
