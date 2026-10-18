import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app-shell";
import { getViewer, homePathFor } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "開始使用" };

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : null;
  const { user, profile } = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  if (profile) redirect(next ?? homePathFor(profile.role));

  const joining = next?.startsWith("/join/") ?? false;
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  const suggestedName = (meta?.full_name ?? meta?.name ?? "").slice(0, 30);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-8">
      <div className="display flex items-center gap-2 text-2xl text-ink">
        <LogoMark />
        揪練
      </div>
      <h1 className="display mt-10 text-3xl leading-snug text-ink">先認識一下你</h1>
      <p className="mt-2 text-ink-2">
        {joining ? "填好名字就能加入小團，教練和家人會看到這個名字。" : "教練和學員看到的畫面不一樣，選一個最符合你的。"}
      </p>
      <div className="mt-8">
        <OnboardingForm
          next={next}
          lockedRole={joining ? "student" : null}
          initialRole={sp.role === "coach" ? "coach" : sp.role === "student" ? "student" : null}
          suggestedName={suggestedName}
        />
      </div>
    </main>
  );
}
