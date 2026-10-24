// Supabase 連線資訊。publishable key 本來就是公開給瀏覽器用的（資料權限由資料庫的 RLS 與 RPC 把關），
// 所以直接寫在這裡，Vercel 不需要另外設定環境變數；若有設定環境變數則以環境變數為準。
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://xtxncpbhmjildahfontt.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_pRzIdOUrMuguzZaaamcrjg_flI2G8w_";

export const APP_NAME = "揪練";
export const TIME_ZONE = "Asia/Taipei";

/** 長輩模式（大字）的 cookie：根版面在伺服器端就要知道字級 */
export const SIZE_COOKIE = "jl_size";
