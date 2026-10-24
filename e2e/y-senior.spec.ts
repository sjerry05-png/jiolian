import { expect, test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// 中高齡功能端對端測試（全新帳號，不需要示範帳號密碼）
// E2E_BASE_URL=https://jiolian.vercel.app E2E_PASSWORD=x npx playwright test e2e/y-senior.spec.ts
// 會留下 smoke-*@test.jiolian.app 帳號，測完用 SQL 清掉（見 README）。

const STAMP = Date.now().toString(36);
const PW = `Senior-${STAMP}-pw`;
const COACH = { email: `smoke-scoach-${STAMP}@test.jiolian.app`, name: "陳教練" };
const GRANDMA = { email: `smoke-grandma-${STAMP}@test.jiolian.app`, name: "阿嬤" };
const DAUGHTER = { email: `smoke-daughter-${STAMP}@test.jiolian.app`, name: "女兒" };
const SHOTS = path.join(__dirname, ".artifacts", "senior");

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
  page.on("dialog", (d) => d.accept());
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

async function login(page: Page, email: string, next = "/home") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("密碼").fill(PW);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function joinViaInvite(page: Page, invitePath: string, who: { email: string; name: string }) {
  await page.goto(invitePath);
  await page.getByRole("link", { name: "登入並加入" }).click();
  await signUp(page, who.email);
  await page.waitForURL((u) => u.pathname === invitePath);
  await page.getByRole("link", { name: "填好名字並加入" }).click();
  await page.getByLabel("你的名字").fill(who.name);
  await page.getByRole("button", { name: "完成，加入小團" }).click();
  await page.waitForURL((u) => u.pathname === invitePath);
  await page.getByRole("button", { name: `以「${who.name}」加入小團` }).click();
  await page.waitForURL(/\/me\?joined=/);
}

function daysAgo(n: number) {
  const d = new Date(Date.now() + 8 * 3600_000 - n * 86400_000);
  return d.toISOString().slice(0, 10);
}

async function fillAssessment(
  page: Page,
  opts: { day?: string; bp?: [string, string, string]; values: Record<string, string> },
) {
  await page.getByRole("button", { name: "全部都「否」" }).click();
  await expect(page.getByText("安全檢查通過")).toBeVisible();
  if (opts.bp) {
    await page.getByLabel("收縮壓").fill(opts.bp[0]);
    await page.getByLabel("舒張壓").fill(opts.bp[1]);
    await page.getByLabel("心跳").fill(opts.bp[2]);
  }
  if (opts.day) await page.getByLabel("測驗日期").fill(opts.day);
  for (const [key, v] of Object.entries(opts.values)) {
    await page.locator(`#t-${key}`).fill(v);
  }
}

test.describe.serial("中高齡：小考、生活目標、身體感受、家族動態", () => {
  let invitePath = "";
  let groupId = "";
  let grandmaId = "";

  test("教練註冊並開團", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    await page.goto("/login?mode=signup");
    await signUp(page, COACH.email);
    await page.waitForURL(/\/onboarding/);
    await page.getByLabel("你的名字").fill(COACH.name);
    await page.getByText("我是教練").click();
    await page.getByRole("button", { name: "開始使用" }).click();
    await page.waitForURL(/\/coach\/groups\/new/);
    await page.getByLabel("小團名稱").fill(`阿嬤肌力班 ${STAMP}`);
    await page.getByLabel(/地點說明/).fill("阿嬤家客廳");
    await page.getByRole("button", { name: "建立小團，拿邀請連結" }).click();
    await page.waitForURL(/\/coach\/groups\/[0-9a-f-]+\?tab=members&created=1/);
    const inviteUrl = (await page.locator("span.num", { hasText: "/join/" }).first().textContent())!.trim();
    invitePath = new URL(inviteUrl).pathname;
    groupId = page.url().match(/groups\/([0-9a-f-]+)/)![1];
    expect(errors).toEqual([]);
    await context.close();
  });

  test("阿嬤加入、開長輩模式、填基本資料與這週感受", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    await joinViaInvite(page, invitePath, GRANDMA);

    await page.goto("/settings");
    const toggle = page.getByRole("switch", { name: /長輩模式/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveAttribute("data-size", "lg");
    const bodyForm = page.locator("form", { has: page.getByLabel("出生年") });
    await bodyForm.getByLabel("出生年").fill("1956");
    await bodyForm.getByRole("button", { name: "女", exact: true }).click();
    await bodyForm.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(bodyForm.getByText("已儲存")).toBeVisible();
    await shot(page, "01-grandma-settings");

    await page.goto("/me");
    await expect(page.locator("html")).toHaveAttribute("data-size", "lg");
    await page.getByRole("button", { name: "疼痛 7 分" }).click();
    await page.getByRole("button", { name: "膝蓋" }).click();
    await page.getByRole("group", { name: "睡眠" }).getByRole("button").nth(2).click();
    await page.getByRole("group", { name: "精神" }).getByRole("button").nth(2).click();
    await page.getByRole("button", { name: "送出這週感受" }).click();
    await expect(page.getByRole("button", { name: "修改" })).toBeVisible();
    await shot(page, "02-grandma-today-large");
    expect(errors).toEqual([]);
    await context.close();
  });

  test("阿嬤設定生活目標，其中一個做到了", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    await login(page, GRANDMA.email, "/me/progress");
    // 還沒有目標時，新增表單預設就是打開的
    await expect(page.getByLabel(/現在覺得吃力/)).toBeVisible();
    await page.getByLabel(/現在覺得吃力/).fill("不扶扶手爬到 3 樓");
    await page.getByRole("group", { name: "起始分數" }).getByRole("button", { name: "3 分" }).click();
    await page.getByRole("button", { name: "加入目標" }).click();
    await expect(page.getByText("不扶扶手爬到 3 樓")).toBeVisible();

    await page.getByRole("button", { name: "新增生活目標" }).click();
    await page.getByLabel(/現在覺得吃力/).fill("蹲下撿東西不用扶");
    await page.getByRole("group", { name: "起始分數" }).getByRole("button", { name: "4 分" }).click();
    await page.getByRole("button", { name: "加入目標" }).click();
    const goal = page.locator("li", { hasText: "蹲下撿東西不用扶" }).first();
    await goal.getByRole("button", { name: /做到了/ }).click();
    await expect(page.getByRole("button", { name: "取消「蹲下撿東西不用扶」的做到了" })).toBeVisible();
    await shot(page, "03-grandma-goals");
    expect(errors).toEqual([]);
    await context.close();
  });

  test("女兒加入，在家族動態看到阿嬤做到了，但看不到阿嬤的分數", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    await joinViaInvite(page, invitePath, DAUGHTER);
    await page.goto(`/me/groups/${groupId}`);
    await expect(page.getByText("「蹲下撿東西不用扶」")).toBeVisible();
    await expect(page.getByText("不扶扶手爬到 3 樓")).toHaveCount(0);
    await shot(page, "04-daughter-family-feed");
    expect(errors).toEqual([]);
    await context.close();
  });

  test("教練看板出現阿嬤膝蓋痛的提醒，幫阿嬤做兩次體能小考", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    await login(page, COACH.email, "/coach");
    await expect(page.getByText(/阿嬤/).first()).toBeVisible();
    await expect(page.getByText(/膝蓋/).first()).toBeVisible();
    await shot(page, "05-coach-dashboard-alert");

    await page.goto(`/coach/groups/${groupId}?tab=members`);
    await page.getByRole("link", { name: /阿嬤/ }).first().click();
    await page.waitForURL(/\/coach\/students\/[0-9a-f-]+/);
    grandmaId = page.url().match(/students\/([0-9a-f-]+)/)![1];
    await page.getByRole("link", { name: "開始體能小考" }).click();
    await page.waitForURL(/\/assess/);
    await shot(page, "06-assess-form");

    // 第一次（35 天前）
    await fillAssessment(page, {
      day: daysAgo(35),
      bp: ["128", "82", "76"],
      values: { chair_stand: "10", arm_curl: "11", up_and_go: "7.5", grip: "17", single_leg: "8", sit_reach: "-3" },
    });
    await page.getByRole("button", { name: /儲存.*小考/ }).click();
    await page.waitForURL(/\/coach\/students\/[0-9a-f-]+\?assessed=/);
    await expect(page.getByText("小考存好了，下面是跟之前的比較。")).toBeVisible();

    // 第二次（今天）
    await page.getByRole("link", { name: "再測一次" }).click();
    await page.waitForURL(/\/assess/);
    await fillAssessment(page, {
      values: { chair_stand: "13", arm_curl: "12", up_and_go: "6.6", grip: "19", single_leg: "15", sit_reach: "1" },
    });
    await page.getByRole("button", { name: /儲存.*小考/ }).click();
    await page.waitForURL(/\/coach\/students\/[0-9a-f-]+\?assessed=/);
    await expect(page.getByText(/項明顯進步/)).toBeVisible();
    await expect(page.getByText(/贏過約/).first()).toBeVisible();
    await shot(page, "07-coach-student-report");
    expect(errors).toEqual([]);
    await context.close();
  });

  test("阿嬤在進度頁看到成績單與同齡排名", async ({ browser }) => {
    const { page, errors, context } = await fresh(browser);
    await login(page, GRANDMA.email, "/me/progress");
    await expect(page.getByText(/項明顯進步/)).toBeVisible();
    await expect(page.getByText(/贏過約 \d+% 的 70–74 歲女性/).first()).toBeVisible();
    await shot(page, "08-grandma-progress");
    expect(errors).toEqual([]);
    expect(grandmaId).not.toEqual("");
    await context.close();
  });
});
