import { requireProfile } from "@/lib/auth";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  await requireProfile("coach");
  return children;
}
