import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Empty } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { LOCATION_LABEL } from "@/lib/format";
import { profilesByIds, studentGroups } from "@/lib/queries";

export const metadata: Metadata = { title: "小團" };

export default async function StudentGroups() {
  const { supabase, user } = await requireProfile("student");
  const groups = await studentGroups(supabase, user.id);
  if (groups.length === 1) redirect(`/me/groups/${groups[0].id}`);
  const coaches = await profilesByIds(
    supabase,
    groups.map((g) => g.coach_id),
  );

  return (
    <div className="space-y-5">
      <h1 className="display text-3xl text-ink">小團</h1>
      {groups.length === 0 ? (
        <Empty title="你還沒加入任何小團">請教練傳邀請連結給你，打開連結就能加入。</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-2xl bg-surface">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/me/groups/${g.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="display text-lg text-ink">{g.name}</p>
                  <p className="text-sm text-ink-3">
                    {coaches.get(g.coach_id)?.display_name}・{LOCATION_LABEL[g.default_location_type]}
                  </p>
                </div>
                <ChevronRight className="size-5 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
