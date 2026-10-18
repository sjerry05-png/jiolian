import { requireProfile } from "@/lib/auth";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireProfile("student");
  return children;
}
