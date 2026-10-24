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

**中高齡（長輩）**
- 體能小考：教練或學員自己測，項目同體育署 65 歲以上檢測（30 秒椅子坐立、30 秒手臂屈舉、2 分鐘原地抬膝、椅子坐姿體前彎、抓背、2.44 公尺起身繞物）＋握力、開眼單足立；每項附測法、計時器、生活意義
- 測前安全檢查：7 題（參考 PAR-Q），任一題「是」要勾「已取得醫師同意」才能存；血壓超過 140/90 或心跳超過 100 會提醒，180/110 以上擋下
- 成績單：跟第一次比的「明顯進步／持平／退步」、台灣同齡同性別排名（常模：Wang CW et al., Healthcare 2024;12(2):213，嘉義 3,332 位 55～95 歲長者）、握力低於 AWGS 2019 肌少症值會提醒
- 生活目標：最多 5 件吃力的事，0～10 分、每 4 週重打；按「做到了」會出現在家族動態（可選不分享）
- 每週身體感受：疼痛（0～10、部位）、睡眠、精神；教練看板列出疼痛 ≥ 6、比上次多 2 分以上、睡不好或沒精神的學員
- 長輩模式：設定裡一鍵放大全站字體與按鈕
- 隱私：年齡性別、小考、分數、身體感受只有本人與教練看得到；家人只看得到願意分享的「做到了」

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
| `20261023000006_jiolian_signup_gate.sql` | 註冊限流（全站每小時 60、同 IP 每小時 8） |
| `20261024000007_jiolian_senior.sql` | 中高齡：長輩模式、基本資料、體能小考、生活目標、每週身體感受、教練身體警示（正式資料庫分 6 段套用） |

Edge Function：`supabase/functions/jiolian-signup`（部署時 `verify_jwt = false`）。註冊時由伺服器呼叫，直接建立已驗證的 Email 帳號，不寄驗證信。

規則測試：`supabase/tests/fit_rules_test.sql`（75 項）與 `supabase/tests/fit_senior_test.sql`（49 項），本機 Postgres 搭配 `supabase/tests/local_auth_stub.sql` 執行，全部通過。

注意：Supabase 連接器對含 `DELETE` 的 migration 會跳確認視窗，手機上可能看不到而被取消；新的刪除功能盡量用「隱藏」（`deleted_at`）。

## 登入設定

**Email 註冊不用另外設定。** 註冊走 Edge Function `jiolian-signup` 直接建立帳號，所以不必關掉 Supabase 的「Confirm email」（同專案的 TCB Bloom Together 不受影響）。

限制：Supabase 內建寄信服務只寄給專案成員，所以「忘記密碼」信寄不到一般使用者；要開放的話，到 Authentication → Emails → SMTP Settings 接自己的寄信服務（例如 Resend）。

**Google 登入（選用）**：登入頁會自動偵測，Supabase 開通後 5 分鐘內按鈕就會出現。
1. Google Cloud Console → APIs & Services → Credentials → 建立 OAuth 用戶端 ID（網頁應用程式）
   - 已授權的重新導向 URI：`https://xtxncpbhmjildahfontt.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Sign In / Providers → Google：填入 Client ID / Secret，開啟
3. Supabase → Authentication → URL Configuration → Redirect URLs：加入 `https://jiolian.vercel.app/**`

## 部署

Vercel 團隊 `bkc` 的 `jiolian` 專案，函式在新加坡（sin1），正式網址 https://jiolian.vercel.app 。

## 本機開發

```bash
npm install
npm run dev
```

不需要環境變數；Supabase 網址與 publishable key 寫在 `src/lib/config.ts`（可用 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 覆蓋）。

## 端對端測試

- 中高齡流程（教練、阿嬤、女兒三個全新帳號：長輩模式、身體感受、生活目標、家族動態、兩次體能小考、同齡排名）：
  `E2E_BASE_URL=https://jiolian.vercel.app E2E_PASSWORD=x npx playwright test e2e/y-senior.spec.ts`
- 正式網站冒煙測試（全新帳號從註冊走到打卡，不需要示範帳號）：
  `E2E_BASE_URL=https://jiolian.vercel.app E2E_PASSWORD=x npx playwright test e2e/z-prod-smoke.spec.ts`
  測完用 SQL 清掉：`delete from auth.users where email like 'smoke-%@test.jiolian.app';`
- 完整流程（示範帳號）見 `e2e/README.md`。
