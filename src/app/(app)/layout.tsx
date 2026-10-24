import { AppShell } from "@/components/app-shell";
import { SizeSync } from "@/components/size-sync";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireProfile();
  const { count } = await supabase
    .from("fit_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return (
    <AppShell role={profile.role} unread={count ?? 0}>
      <SizeSync large={profile.large_text} />
      {children}
    </AppShell>
  );
}
