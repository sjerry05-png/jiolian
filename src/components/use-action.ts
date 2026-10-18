"use client";

import { useCallback, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/types";

/** 執行 Server Action、處理 loading 與錯誤訊息 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(<T,>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T) => void) => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (!r) return;
        if (r.ok) onOk?.(r.data);
        else setError(r.error);
      } catch (e) {
        // redirect() 會丟出特殊錯誤讓 Next.js 處理，不要吞掉
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) {
          throw e;
        }
        setError("連線失敗，請檢查網路後再試一次");
      }
    });
  }, []);

  return { pending, error, setError, run };
}
