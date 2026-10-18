"use client";

import { leaveGroup } from "@/app/actions/fit";
import { Button } from "@/components/ui";
import { useAction } from "@/components/use-action";

export function LeaveGroupButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="text-right">
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`確定要退出「${groupName}」嗎？還沒過取消期限的報名會自動取消。`)) run(() => leaveGroup(groupId));
        }}
      >
        退出小團
      </Button>
      {error ? <p className="mt-1 text-sm text-stop">{error}</p> : null}
    </div>
  );
}
