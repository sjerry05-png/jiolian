import type { Metadata } from "next";
import { CheckinCalendar } from "@/components/checkin-calendar";
import { MetricsPanel } from "@/components/metrics-panel";
import { Panel, SectionTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { taipeiDateDaysAgo, todayInTaipei } from "@/lib/format";
import type { Metric, MySummary } from "@/lib/types";

export const metadata: Metadata = { title: "進度" };

export default async function StudentProgress() {
  const { supabase, user } = await requireProfile("student");
  const today = todayInTaipei();
  const since = taipeiDateDaysAgo(80);

  const [checkinsRes, metricsRes, summaryRes] = await Promise.all([
    supabase.from("fit_checkins").select("day").eq("user_id", user.id).gte("day", since),
    supabase
      .from("fit_metrics")
      .select("id, user_id, measured_on, weight_kg, body_fat_pct, waist_cm, note, recorded_by, created_at")
      .eq("user_id", user.id)
      .order("measured_on"),
    supabase.rpc("fit_my_summary"),
  ]);

  const counts = new Map<string, number>();
  for (const c of (checkinsRes.data ?? []) as { day: string }[]) counts.set(c.day, (counts.get(c.day) ?? 0) + 1);
  const summary = summaryRes.data as MySummary | null;

  return (
    <div className="space-y-6">
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

      <Panel>
        <SectionTitle>打卡日曆</SectionTitle>
        <CheckinCalendar counts={counts} today={today} />
      </Panel>

      <Panel>
        <SectionTitle>身體數據</SectionTitle>
        <p className="-mt-1 mb-4 text-sm text-ink-2">只有你和你的教練看得到。</p>
        <MetricsPanel metrics={(metricsRes.data ?? []) as Metric[]} userId={null} viewerId={user.id} />
      </Panel>
    </div>
  );
}
