"use client";

import { useEffect } from "react";
import { SIZE_COOKIE } from "@/lib/config";

/**
 * 長輩模式記在帳號上；換一台手機登入時 cookie 還沒有，這裡補上並立刻套用。
 */
export function SizeSync({ large }: { large: boolean }) {
  useEffect(() => {
    const root = document.documentElement;
    const has = root.dataset.size === "lg";
    if (large === has) return;
    if (large) {
      root.dataset.size = "lg";
      document.cookie = `${SIZE_COOKIE}=lg; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
    } else {
      delete root.dataset.size;
      document.cookie = `${SIZE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    }
  }, [large]);
  return null;
}
