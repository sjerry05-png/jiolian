"use client";

import { joinGroup } from "@/app/actions/fit";
import { Button, ErrorText } from "@/components/ui";
import { useAction } from "@/components/use-action";

export function JoinButton({ code, name }: { code: string; name: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-3">
      <ErrorText>{error}</ErrorText>
      <Button size="lg" className="w-full" disabled={pending} onClick={() => run(() => joinGroup(code))}>
        {pending ? "加入中…" : `以「${name}」加入小團`}
      </Button>
    </div>
  );
}
