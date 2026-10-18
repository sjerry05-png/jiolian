import { defineConfig, devices } from "@playwright/test";

// 端對端測試：用手機尺寸跑 next start（連真的 Supabase），詳見 e2e/README.md
// 雲端環境的 HTTPS 代理只接受 CONNECT，所以本機網址要繞過代理
const proxyArgs = process.env.HTTPS_PROXY
  ? [`--proxy-server=${process.env.HTTPS_PROXY}`, "--proxy-bypass-list=localhost;127.0.0.1"]
  : [];

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "e2e/.artifacts/results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    ...devices["Pixel 7"],
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    launchOptions: { args: proxyArgs },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
