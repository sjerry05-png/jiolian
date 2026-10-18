# 揪練 JioFit

給小團教練的排課、計價與盯梢工具。教練帶一家人或一群朋友組成小團，在學員家中、健身房、公園或線上上課；人越多每人越便宜，教練每小時收入越高；學員每天打卡，教練用紅黃綠燈盯進度。

- 網址：https://jiolian.vercel.app
- 技術：Next.js 16（App Router）＋ Tailwind 4 ＋ TypeScript ＋ Supabase（PostgreSQL、Auth），部署在 Vercel（函式在新加坡 sin1）
- 資料庫：與「TCB Bloom Together」共用 Supabase 專案 `xtxncpbhmjildahfontt`，所有物件都以 `fit_` 開頭，內部函式放在 `fit_internal` schema

## 功能

**教練**
- 開小團：設定價目表（1 人、2 人……每人各多少錢）、預設地點、每堂長度、免費取消期限
- 邀請連結：複製或用 LINE 傳送，學員點開就能加入
- 排課：可一次排每週固定時段（最多 12 週），可選「幫全團先報名」
- 看板：本月應收、已收、未收、比一對一多賺幾 %；需要關心的學員（紅黃燈）一鍵督促；待結算的課
- 課堂：即時人數與價格、點名、代學員報名或加家人、下課結算、記錄收款（現金、轉帳、LINE Pay、免收）
- 作業：每週幾次的作業，可給全團或指定學員；回應學員打卡（表情＋一句話）
- 學員頁：打卡日曆、身體數據（可代記）、上課與費用紀錄

**學員**
- 今天：當天作業一鍵打卡、選心情、可補打昨天；連續打卡天數；教練督促訊息
- 課程：看到即時價格與「再揪 1 人每人降到多少」，可帶沒有帳號的家人一起報名
- 進度：打卡日曆、體重／體脂／腰圍趨勢
- 小團：本週家族排行（跑道）、大家的打卡動態、互相加油

## 商業規則（都寫在資料庫的 RPC 裡）

| 規則 | 說明 |
|---|---|
| 階梯價 | 第 n 格 = n 人上課時每人價格，人越多不能越貴；排課時複製一份，之後改小團價目只影響還沒鎖定的課 |
| 計價人數 | 要來＋臨時取消＋出席＋缺席的人數，含同行家人；同行家人由報名者付費 |
| 取消期限 | 預設上課前 12 小時。期限前取消不算錢；期限後取消變「臨時取消」，照人頭計費，其他人價格不變 |
| 鎖定後 | 只能加人不能減人（大家只會更便宜） |
| 結算 | 課程開始後才能結算；還標「要來」的視為出席；已有收款紀錄就不能改點名 |
| 打卡 | 只能打今天或補昨天，每項作業每週最多算到它的次數 |
| 紅黃綠燈 | 紅：3 天以上沒打卡；黃：2 天沒打卡或本週進度落後；綠：正常 |
| 權限 | 資料表只開放讀（RLS），寫入一律走 RPC；家人看得到彼此全團作業的打卡，看不到身體數據與欠款 |

## 資料庫

依序執行 `supabase/migrations/`：

| 檔案 | 內容 |
|---|---|
| `20261014000001_jiolian_tables.sql` | 資料表、RLS、權限判斷函式、課程總覽 view |
| `20261014000002_jiolian_rpcs_core.sql` | 個人資料、小團、課程、報名、結算、收款 |
| `20261014000003_jiolian_rpcs_tracking.sql` | 作業、打卡、身體數據、訊息、追蹤統計、函式權限 |
| `20261014000004_jiolian_rpcs_deletes.sql` | 取消打卡、刪除身體數據（含 DELETE，獨立成一個檔） |
| `20261018000005_jiolian_session_started.sql` | 課程總覽加上 `has_started` |

規則測試：`supabase/tests/fit_rules_test.sql`（本機 Postgres 搭配 `supabase/tests/local_auth_stub.sql` 執行，75 項全部通過）。

## Supabase 登入設定

1. Authentication → Sign In / Providers → Email：關閉「Confirm email」（內建寄信服務只寄給專案成員）
2. Authentication → Sign In / Providers → Google：填入 Google Cloud 的 OAuth Client ID / Secret
   - Google Cloud 的「已授權的重新導向 URI」：`https://xtxncpbhmjildahfontt.supabase.co/auth/v1/callback`
3. Authentication → URL Configuration → Redirect URLs：加入 `https://jiolian.vercel.app/**`

## 本機開發

```bash
npm install
npm run dev
```

不需要環境變數；Supabase 網址與 publishable key 寫在 `src/lib/config.ts`（可用 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 覆蓋）。

## 端對端測試

見 `e2e/README.md`。
