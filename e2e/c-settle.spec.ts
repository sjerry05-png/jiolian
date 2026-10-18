import { expect, test } from "@playwright/test";
import { closeAll, expectNoErrors, loadState, loginAs, shot } from "./helpers";

// 第三階段（先用 SQL 把第一堂課的開始時間移到過去，見 e2e/README.md）：教練結算、收款、回應打卡
test.describe.serial("揪練：下課結算", () => {
  test.afterEach(({ browser }) => closeAll(browser));

  test("教練結算：3 人每人 750，林爸含家人 1500、林媽臨時取消 750", async ({ browser }) => {
    const { sessionId } = loadState();
    const { page, errors } = await loginAs(browser, "coach", "/coach");
    await expect(page.getByText("有 1 堂課上完還沒結算")).toBeVisible();
    await page.goto(`/coach/sessions/${sessionId}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /下課結算/ }).click();
    await expect(page.getByText("3 人上課，每人 $750，共應收 $2,250")).toBeVisible();
    const dad = page.locator("li", { hasText: "林爸" });
    await expect(dad.getByText("$1,500")).toBeVisible();
    const mom = page.locator("li", { hasText: "林媽" });
    await expect(mom.getByText("$750").first()).toBeVisible();

    await page.getByLabel("林爸 的收款").selectOption("linepay");
    await expect(page.getByText("已收 $1,500")).toBeVisible();
    await expect(page.getByLabel("林爸 的出席狀態")).toBeDisabled();
    await shot(page, "14-settled");
    await expectNoErrors(errors);
  });

  test("教練看板：本月應收與比一對一多賺", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "coach", "/coach");
    await expect(page.getByText("$2,250").first()).toBeVisible();
    await expect(page.getByText(/比一對一多 50%/)).toBeVisible();
    await shot(page, "15-coach-income");
    await expectNoErrors(errors);
  });

  test("教練回應林爸的打卡", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "coach", "/coach/groups");
    await page.getByRole("link", { name: /林家週六晨練團/ }).click();
    await page.getByRole("link", { name: /林爸/ }).first().click();
    await page.waitForURL(/\/coach\/students\//);
    await page.getByRole("button", { name: "回應 🔥" }).first().click();
    await expect(page.getByRole("button", { name: "回應 🔥" }).first()).toHaveAttribute("aria-pressed", "true");
    await shot(page, "16-student-detail");
    await expectNoErrors(errors);
  });

  test("林爸看到費用與教練的回應", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "dad", "/me");
    await expect(page.getByText(/教練：/).first()).toBeVisible();
    await page.goto("/me/sessions");
    await expect(page.getByText("$1,500").first()).toBeVisible();
    await expect(page.getByText(/已付・LINE Pay/)).toBeVisible();
    await expectNoErrors(errors);
  });

  test("林媽看到待付 750", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "mom", "/me");
    await expect(page.getByText("待付給教練")).toBeVisible();
    await expect(page.getByRole("link", { name: "$750" })).toBeVisible();
    await page.goto("/me/progress");
    const add = page.getByRole("button", { name: "新增一筆紀錄" });
    if (await add.isVisible()) await add.click();
    await page.getByLabel("體重 kg").fill("58.4");
    await page.getByLabel("腰圍 cm").fill("72");
    await page.getByRole("button", { name: "儲存紀錄" }).click();
    await expect(page.getByRole("img", { name: /體重趨勢/ })).toBeVisible();
    await shot(page, "17-progress");
    await expectNoErrors(errors);
  });
});
