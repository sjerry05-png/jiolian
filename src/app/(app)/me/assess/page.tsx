import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AssessmentForm } from "@/components/assessment-form";
import { BodyInfoForm } from "@/components/fitness-bits";
import { Panel } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { seniorData } from "@/lib/queries";

export const metadata: Metadata = { title: "自己測體能" };

export default async function SelfAssessPage() {
  const { supabase, user } = await requireProfile("student");
  const { body, assessments } = await seniorData(supabase, user.id);
  const latest = assessments.length ? assessments[assessments.length - 1] : null;

  return (
    <div className="space-y-5">
      <Link href="/me/progress" className="inline-flex items-center gap-1 text-sm text-track hover:underline">
        <ChevronLeft className="size-4" aria-hidden />
        進度
      </Link>
      <div>
        <h1 className="display text-3xl text-ink">自己測體能</h1>
        <p className="mt-1 text-ink-2">在家也能測。教練會看到你的成績，下次上課一起看進步。</p>
      </div>
      <p className="rounded-2xl bg-lane-soft px-4 py-3 text-ink">
        請家人在旁邊陪著測，椅子靠牆放穩。覺得頭暈、胸悶或哪裡痛，馬上停下來。
      </p>

      {!body?.sex || !body?.birth_year ? (
        <Panel>
          <p className="font-medium text-ink">先填出生年和性別</p>
          <p className="mt-0.5 mb-3 text-sm text-ink-2">用來跟同齡的人比較，只有你和教練看得到。</p>
          <BodyInfoForm userId={null} birthYear={body?.birth_year ?? null} sex={body?.sex ?? null} compact />
        </Panel>
      ) : null}

      <AssessmentForm userId={null} personName="你" sex={body?.sex ?? null} previous={latest} returnTo="/me/progress" />
    </div>
  );
}
