# 端對端測試

用手機尺寸（Pixel 7）跑完整流程，連線到真的 Supabase。需要 4 個已驗證的示範帳號：
`coach@demo.jiolian.app`、`dad@demo.jiolian.app`、`mom@demo.jiolian.app`、`aunt@demo.jiolian.app`（密碼相同，不寫進程式碼）。

```bash
npm run build && npx next start -p 3100 &
export E2E_PASSWORD='示範帳號密碼'
npx playwright test e2e/a-setup.spec.ts     # 開團、出作業、排課、加入、打卡、報名、督促
```

第二、三階段需要「時間經過」，先用 SQL 移動第一堂課的時間（課程 id 在 `e2e/.artifacts/state.json`）：

```sql
-- 第二階段前：取消期限移到剛剛
update public.fit_sessions set lock_at = now() - interval '1 minute' where id = '<sessionId>';
-- 第三階段前：課程改成一小時前開始
update public.fit_sessions set starts_at = now() - interval '1 hour', lock_at = now() - interval '13 hours' where id = '<sessionId>';
```

```bash
npx playwright test e2e/b-lock.spec.ts      # 鎖定後取消照樣計費、不能減人
npx playwright test e2e/c-settle.spec.ts    # 結算、收款、回應打卡、身體數據
```

截圖在 `e2e/.artifacts/screens/`。第一階段每次都會建立一個新小團；示範帳號的個人資料只能建立一次，重跑前要先清掉這 4 個帳號的 `fit_profiles`。
