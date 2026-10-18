import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { ButtonLink, Empty } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { LOCATION_LABEL, money } from "@/lib/format";
import { coachGroups } from "@/lib/queries";

export const metadata: Metadata = { title: "小團" };

export default async function CoachGroups() {
  const { supabase, user } = await requireProfile("coach");
  const groups = await coachGroups(supabase, user.id, true);
  const ids = groups.map((g) => g.id);
  const { data: members } = ids.length
    ? await supabase.from("fit_group_members").select("group_id").in("group_id", ids).is("left_at", null)
    : { data: [] as { group_id: string }[] };
  const count = (gid: string) => (members ?? []).filter((m) => m.group_id === gid).length;
  const active = groups.filter((g) => !g.archived_at);
  const archived = groups.filter((g) => g.archived_at);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="display text-3xl text-ink">小團</h1>
        <ButtonLink href="/coach/groups/new" size="sm">
          <Plus className="size-4" />
          開新小團
        </ButtonLink>
      </div>
      {active.length === 0 ? (
        <Empty title="還沒有小團">一個家庭、一群朋友就是一個小團。</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-2xl bg-surface">
          {active.map((g) => (
            <li key={g.id}>
              <Link href={`/coach/groups/${g.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="display truncate text-lg text-ink">{g.name}</p>
                  <p className="text-sm text-ink-3">
                    {count(g.id)} 位學員・{LOCATION_LABEL[g.default_location_type]}・一人 {money(g.price_ladder[0])}，
                    {g.price_ladder.length} 人每人 {money(g.price_ladder[g.price_ladder.length - 1])}
                  </p>
                </div>
                <ChevronRight className="size-5 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {archived.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-ink-3">已封存的小團（{archived.length}）</summary>
          <ul className="mt-2 divide-y divide-line rounded-2xl bg-surface">
            {archived.map((g) => (
              <li key={g.id}>
                <Link href={`/coach/groups/${g.id}?tab=settings`} className="block px-4 py-3 text-ink-2 hover:bg-surface-2">
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
