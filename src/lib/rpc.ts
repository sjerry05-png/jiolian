import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

/** 把資料庫錯誤轉成給使用者看的中文訊息 */
export function friendlyError(error: Pick<PostgrestError, "code" | "message"> | null | undefined): string {
  if (!error) return "發生未知錯誤，請再試一次";
  switch (error.code) {
    case "P0001": // 商業規則（RPC 裡的 raise exception），訊息本身就是中文
      return error.message;
    case "23514":
      return "輸入的內容不符合規則，請檢查數字或字數";
    case "23505":
      return "這筆資料已經存在";
    case "42501":
      return "沒有權限做這件事，請重新登入";
    case "PGRST202":
    case "42883":
      return "這個功能還沒開通，請稍後再試";
    default:
      return error.message || "發生未知錯誤，請再試一次";
  }
}

/** 呼叫 RPC 並包成 ActionResult */
export async function callRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, data: data as T };
}
