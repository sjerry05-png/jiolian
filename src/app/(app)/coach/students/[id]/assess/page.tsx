import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AssessmentForm } from "@/components/assessment-form";
import { BodyInfoForm } from "@/components/fitness-bits";
import { Panel } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { coachGroups, seniorData } from "@/lib/queries";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "體能小考" };

export default async function CoachAssessPage(props: PageProps<"/coach/students/[id]/assess">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await requireProfile("coach");

  const groups = await coachGroups(supabase, user.id, true);
  const [{ data: student }, { data: memberships }] = await Promise.all([
    supabase.from("fit_profiles").select("id, display_name, role, phone, bio, large_text").eq("id", id).maybeSingle<Profile>(),
    supabase
      .from("fit_group_members")
      .select("group_id")
      .eq("user_id", id)
      .is("left_at", null)
      .in(
        "group_id",
        groups.map((g) => g.id),
      ),
  ]);
  if (!student || (memberships ?? []).length === 0) notFound();

  const { body, assessments } = await seniorData(supabase, id);
  const latest = assessments.length ? assessments[assessments.length - 1] : null;

  return (
    <div className="space-y-5">
      <Link href={`/coach/students/${id}`} className="inline-flex items-center gap-1 text-sm text-track hover:underline">
        <ChevronLeft className="size-4" aria-hidden />
        {student.display_name}
      </Link>
      <div>
        <h1 className="display text-3xl text-ink">{student.display_name}的體能小考</h1>
        <p className="mt-1 text-ink-2">
          {assessments.length === 0 ? "第一次測，當作起點。" : `第 ${assessments.length + 1} 次。`}
          建議每 4～6 週測一次，同一張椅子、同一個時段，前後才比得準。
        </p>
      </div>

      {!body?.sex || !body?.birth_year ? (
        <Panel>
          <p className="font-medium text-ink">先填出生年和性別</p>
          <p className="mt-0.5 mb-3 text-sm text-ink-2">用來算同齡排名、握力提醒（只有你和學員本人看得到）。</p>
          <BodyInfoForm userId={id} birthYear={body?.birth_year ?? null} sex={body?.sex ?? null} compact />
        </Panel>
      ) : null}

      <AssessmentForm
        userId={id}
        personName={student.display_name}
        sex={body?.sex ?? null}
        previous={latest}
        returnTo={`/coach/students/${id}`}
      />
    </div>
  );
}
