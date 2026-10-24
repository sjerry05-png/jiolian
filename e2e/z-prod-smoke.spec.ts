import { expect, test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// 正式網站冒煙測試：全新帳號從註冊開始走一遍（不需要示範帳號密碼）
// E2E_BASE_URL=https://jiolian.vercel.app npx playwright test e2e/z-prod-smoke.spec.ts
// 會留下 smoke-*@test.jiolian.app 的帳號與一個「冒煙測試團」，測完可用 SQL 清掉。

const STAMP = Date.now().toString(36);
const PW = `Smoke-${STAMP}-pw`;
const COACH = { email: `smoke-coach-${STAMP}@test.jiolian.app`, name: "測試教練" };
const STUDENT = { email: `smoke-student-${STAMP}@test.jiolian.app`, name: "測試學員" };
const SHOTS = path.join(__dirname, ".artifacts", "prod");

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function fresh(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { context, page, errors };
}

async function signUp(page: Page, email: string) {
  await page.getByLabel("Email").waitFor();
  if (await page.getByRole("button", { name: "建立帳號" }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "建立帳號" }).click();
  }
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("密碼").fill(PW);
  await page.getByRole("button", { name: "註冊", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

test.describe.serial("正式網站：註冊 → 開團 → 加入 → 打卡 → 教練看到", () => {
  let inviteUrl = "";
  let groupId = "";

  test("首頁可以打開", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /揪越多人/ })).toBeVisible();
    await shot(page, "00-landing");
    expect(errors).toEqual([]);
    await context.close();
  });

  test("教練註冊、開團、出作業", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    await page.goto("/login?mode=signup");
    await shot(page, "01-login");
    await signUp(page, COACH.email);
    await page.waitForURL(/\/onboarding/);
    await page.getByLabel("你的名字").fill(COACH.name);
    await page.getByText("我是教練").click();
    await page.getByRole("button", { name: "開始使用" }).click();

    await page.waitForURL(/\/coach\/groups\/new/);
    await page.getByLabel("小團名稱").fill(`冒煙測試團 ${STAMP}`);
    await page.getByLabel(/地點說明/).fill("學員家客廳");
    await page.getByRole("button", { name: "建立小團，拿邀請連結" }).click();
    await page.waitForURL(/\/coach\/groups\/[0-9a-f-]+\?tab=members&created=1/);
    inviteUrl = (await page.locator("span.num", { hasText: "/join/" }).first().textContent())!.trim();
    groupId = page.url().match(/groups\/([0-9a-f-]+)/)![1];
    await shot(page, "02-group-created");

    await page.goto(`/coach/groups/${groupId}?tab=habits`);
    await page.getByLabel("作業內容").fill("深蹲 3 組 × 15 下");
    await page.getByRole("button", { name: "4", exact: true }).click();
    await page.getByRole("button", { name: "新增作業" }).click();
    await expect(page.getByText("每週 4 次・全團")).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });

  test("學員用邀請連結註冊加入並打卡", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    const invitePath = new URL(inviteUrl).pathname;
    await page.goto(invitePath);
    await shot(page, "03-join-preview");
    await page.getByRole("link", { name: "登入並加入" }).click();
    await signUp(page, STUDENT.email);
    await page.waitForURL((u) => u.pathname === invitePath);
    await page.getByRole("link", { name: "填好名字並加入" }).click();
    await page.getByLabel("你的名字").fill(STUDENT.name);
    await page.getByRole("button", { name: "完成，加入小團" }).click();
    await page.waitForURL((u) => u.pathname === invitePath);
    await page.getByRole("button", { name: `以「${STUDENT.name}」加入小團` }).click();
    await page.waitForURL(/\/me\?joined=/);
    await expect(page.getByText("深蹲 3 組 × 15 下")).toBeVisible();
    await page.getByRole("button", { name: "「深蹲 3 組 × 15 下」打卡" }).click();
    await expect(page.getByRole("button", { name: "取消「深蹲 3 組 × 15 下」今天的打卡" })).toBeVisible();
    await shot(page, "04-student-checked-in");
    // 取消打卡（這次補上的資料庫函式）再打回來
    await page.getByRole("button", { name: "取消「深蹲 3 組 × 15 下」今天的打卡" }).click();
    await expect(page.getByRole("button", { name: "「深蹲 3 組 × 15 下」打卡" })).toBeVisible();
    await page.getByRole("button", { name: "「深蹲 3 組 × 15 下」打卡" }).click();
    await expect(page.getByRole("button", { name: "取消「深蹲 3 組 × 15 下」今天的打卡" })).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });

  test("教練看板看得到學員打卡", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    await page.goto("/login");
    await page.getByLabel("Email").fill(COACH.email);
    await page.getByLabel("密碼").fill(PW);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.goto(`/coach/groups/${groupId}?tab=members`);
    await expect(page.getByText(STUDENT.name).first()).toBeVisible();
    await shot(page, "05-coach-members");
    expect(errors).toEqual([]);
    await context.close();
  });
});
