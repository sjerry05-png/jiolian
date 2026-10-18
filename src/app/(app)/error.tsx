"use client";

import { Button } from "@/components/ui";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-10">
      <h1 className="display text-2xl text-ink">畫面載入失敗</h1>
      <p className="mt-2 text-ink-2">可能是網路不穩，請再試一次。如果一直發生，請重新登入。</p>
      <Button className="mt-5" onClick={reset}>
        重新載入
      </Button>
    </div>
  );
}
