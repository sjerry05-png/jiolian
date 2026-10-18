import type { Metadata } from "next";
import { GroupForm } from "@/components/group-form";

export const metadata: Metadata = { title: "開新小團" };

export default function NewGroupPage() {
  return (
    <div>
      <h1 className="display text-3xl text-ink">開一個新小團</h1>
      <p className="mt-1 mb-6 text-ink-2">建立後會拿到邀請連結，傳到家人或朋友的 LINE 群組就好。</p>
      <GroupForm />
    </div>
  );
}
