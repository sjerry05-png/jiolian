import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/auth";

// 登入後的分流：還沒填資料 → onboarding；教練 → 看板；學員 → 今天
export default async function HomeRedirect() {
  const { user, profile } = await getViewer();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");
  redirect(homePathFor(profile.role));
}
