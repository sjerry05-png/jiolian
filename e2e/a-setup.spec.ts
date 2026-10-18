import { expect, test } from "@playwright/test";
import { closeAll, expectNoErrors, loadState, loginAs, newUserPage, passwordLogin, saveState, shot, USERS } from "./helpers";

// 第一階段：教練開團、出作業、排課；三位家人用邀請連結加入、打卡、報名；教練督促
test.describe.serial("揪練：開團到督促", () => {
  test.afterEach(({ browser }) => closeAll(browser));

  test("首頁與價格階梯", async ({ browser }) => {
    const { page, errors } = await newUserPage(browser);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /揪越多人/ })).toBeVisible();
    await expect(page.getByText("$750").first()).toBeVisible();
    await page.getByRole("button", { name: "多一人" }).click();
    await expect(page.locator("output").first()).toHaveText("4");
    await expect(page.getByText("$2,520").first()).toBeVisible();
    await shot(page, "00-landing");
    await expectNoErrors(errors);
  });

  test("教練註冊身分並開團", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "coach");
    await page.waitForURL(/\/onboarding/);
    await page.getByLabel("你的名字").fill(USERS.coach.name);
    await page.getByText("我是教練").click();
    await shot(page, "01-onboarding");
    await page.getByRole("button", { name: "開始使用" }).click();

    await page.waitForURL(/\/coach\/groups\/new/);
    await page.getByLabel("小團名稱").fill("林家週六晨練團");
    await page.getByLabel(/介紹/).fill("每週六早上在家練核心與肌力，適合完全沒運動習慣的人。");
    await page.getByLabel(/地點說明/).fill("林家客廳（中和）");
    await expect(page.getByLabel("3 人時每人價格")).toHaveValue("750");
    await shot(page, "02-new-group");
    await page.getByRole("button", { name: "建立小團，拿邀請連結" }).click();

    await page.waitForURL(/\/coach\/groups\/[0-9a-f-]+\?tab=members&created=1/);
    await expect(page.getByText("小團建好了")).toBeVisible();
    const inviteUrl = (await page.locator("span.num", { hasText: "/join/" }).first().textContent())!.trim();
    expect(inviteUrl).toMatch(/\/join\/[A-Z0-9]{8}$/);
    const groupId = page.url().match(/groups\/([0-9a-f-]+)/)![1];
    saveState({ inviteUrl, groupId });
    await shot(page, "03-group-invite");
    await expectNoErrors(errors);
  });

  test("教練出作業、連排 4 週課", async ({ browser }) => {
    const { groupId } = loadState();
    const { page, errors } = await loginAs(browser, "coach", `/coach/groups/${groupId}?tab=habits`);
    await page.getByLabel("作業內容").fill("深蹲 3 組 × 15 下");
    await page.getByLabel(/怎麼做/).fill("膝蓋對準腳尖方向，組間休息 60 秒");
    await page.getByRole("button", { name: "4", exact: true }).click();
    await page.getByRole("button", { name: "新增作業" }).click();
    await expect(page.getByText("每週 4 次・全團")).toBeVisible();
    await page.getByLabel("作業內容").fill("飯後散步 20 分鐘");
    await page.getByLabel(/怎麼做/).fill("");
    await page.getByRole("button", { name: "5", exact: true }).click();
    await page.getByRole("button", { name: "新增作業" }).click();
    await expect(page.getByText("每週 5 次・全團")).toBeVisible();
    await shot(page, "04-habits");

    await page.goto(`/coach/groups/${groupId}?tab=sessions`);
    await page.getByRole("button", { name: "排一堂課" }).click();
    await page.getByLabel("這堂主題").fill("核心入門");
    await page.getByLabel("每週同一時間，連排幾週").selectOption("4");
    await page.getByRole("button", { name: "排 4 堂課" }).click();
    await expect(page.getByText("已排好 4 堂課")).toBeVisible();
    await expect(page.locator('a[href^="/coach/sessions/"]')).toHaveCount(4);
    const firstSession = await page.locator('a[href^="/coach/sessions/"]').first().getAttribute("href");
    saveState({ sessionId: firstSession!.split("/").pop()! });
    await shot(page, "05-sessions");
    await expectNoErrors(errors);
  });

  for (const who of ["dad", "mom", "aunt"] as const) {
    test(`${USERS[who].name} 用邀請連結加入`, async ({ browser }) => {
      const { inviteUrl } = loadState();
      const invitePath = new URL(inviteUrl).pathname;
      const { page, errors } = await newUserPage(browser);
      await page.goto(invitePath);
      await expect(page.getByRole("heading", { name: "林家週六晨練團" })).toBeVisible();
      if (who === "dad") await shot(page, "06-join-preview");
      await page.getByRole("link", { name: "登入並加入" }).click();
      await passwordLogin(page, USERS[who].email);
      await page.waitForURL((u) => u.pathname === invitePath);
      await page.getByRole("link", { name: "填好名字並加入" }).click();
      await page.getByLabel("你的名字").fill(USERS[who].name);
      await page.getByRole("button", { name: "完成，加入小團" }).click();
      await page.waitForURL((u) => u.pathname === invitePath);
      await page.getByRole("button", { name: `以「${USERS[who].name}」加入小團` }).click();
      await page.waitForURL(/\/me\?joined=/);
      await expect(page.getByText("已加入「林家週六晨練團」")).toBeVisible();
      await expect(page.getByText("深蹲 3 組 × 15 下")).toBeVisible();
      await expectNoErrors(errors);
    });
  }

  test("林爸打卡、選心情，帶一位家人報名", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "dad", "/me");
    await page.getByRole("button", { name: "「深蹲 3 組 × 15 下」打卡" }).click();
    await expect(page.getByRole("button", { name: "取消「深蹲 3 組 × 15 下」今天的打卡" })).toBeVisible();
    await page.getByRole("button", { name: "不錯" }).click();
    await expect(page.getByRole("button", { name: "不錯" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "「飯後散步 20 分鐘」打卡" }).click();
    await expect(page.getByText("今天的作業都完成了")).toBeVisible();

    const ticket = page.locator("article").first();
    await ticket.getByRole("button", { name: "多一位家人" }).click();
    await expect(ticket.getByRole("button", { name: /我要來，每人 \$975/ })).toBeVisible();
    await ticket.getByRole("button", { name: /我要來/ }).click();
    await expect(ticket.getByRole("button", { name: /已報名（含 1 位家人）/ })).toBeVisible();
    await expect(ticket.getByText("再 1 人 → $630")).toHaveCount(0);
    await expect(ticket.getByText(/再 1 人 → \$750/)).toBeVisible();
    await shot(page, "07-student-today");
    await expectNoErrors(errors);
  });

  test("林媽報名後，價格降到每人 750", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "mom", "/me/sessions");
    const ticket = page.locator("article").first();
    await expect(ticket.getByRole("button", { name: /我要來，每人 \$750/ })).toBeVisible();
    await ticket.getByRole("button", { name: /我要來/ }).click();
    await expect(ticket.getByRole("button", { name: "✓ 已報名" })).toBeVisible();
    await expect(ticket.getByText(/目前\s*3\s*人/)).toBeVisible();
    await page.goto("/me");
    await page.getByRole("button", { name: "「深蹲 3 組 × 15 下」打卡" }).click();
    await expect(page.getByRole("button", { name: "取消「深蹲 3 組 × 15 下」今天的打卡" })).toBeVisible();
    await expectNoErrors(errors);
  });

  test("教練看板：阿姨落後，傳督促", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "coach", "/coach");
    await expect(page.getByRole("heading", { name: "需要你關心" })).toBeVisible();
    const row = page.locator("li", { hasText: "阿姨" }).first();
    await expect(row).toBeVisible();
    await shot(page, "08-coach-dashboard");
    await row.getByRole("button", { name: "督促" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await shot(page, "09-nudge-sheet");
    await dialog.getByRole("button", { name: "傳送" }).click();
    await expect(row.getByText("已傳送")).toBeVisible();

    const { groupId } = loadState();
    await page.goto(`/coach/groups/${groupId}?tab=members`);
    await expect(page.locator("li", { hasText: "林爸" }).first()).toBeVisible();
    await shot(page, "10-coach-members");
    await expectNoErrors(errors);
  });

  test("阿姨收到督促、回覆教練", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "aunt", "/me");
    await expect(page.getByText("這週還沒看到你打卡喔")).toBeVisible();
    await shot(page, "11-aunt-nudged");
    await page.getByText("這週還沒看到你打卡喔").click();
    await page.waitForURL(/\/messages$/);
    await page.getByRole("link", { name: /王教練/ }).click();
    await expect(page.getByText("【督促】")).toBeVisible();
    await page.getByLabel("訊息內容").fill("收到！今天晚上就去散步");
    await page.getByRole("button", { name: "傳送" }).click();
    await expect(page.getByText("收到！今天晚上就去散步")).toBeVisible();
    await shot(page, "12-thread");
    await expectNoErrors(errors);
  });

  test("林媽在小團頁看到排行、幫林爸加油", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "mom", "/me/groups");
    await page.waitForURL(/\/me\/groups\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name: "本週排行" })).toBeVisible();
    const dadLane = page.locator("li", { hasText: "林爸" }).first();
    await dadLane.getByRole("button", { name: "加油" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "傳送" }).click();
    await expect(dadLane.getByText("已傳送")).toBeVisible();
    await expect(page.getByText(/完成了「深蹲 3 組 × 15 下」/).first()).toBeVisible();
    await shot(page, "13-family-board");
    await expectNoErrors(errors);
  });
});
