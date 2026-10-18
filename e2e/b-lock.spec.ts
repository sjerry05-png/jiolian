import { expect, test } from "@playwright/test";
import { closeAll, expectNoErrors, loginAs } from "./helpers";

// 第二階段（先用 SQL 把第一堂課的取消期限移到過去，見 e2e/README.md）：鎖定後取消要付費
test.describe.serial("揪練：過了取消期限", () => {
  test.afterEach(({ browser }) => closeAll(browser));

  test("林媽臨時取消 → 照樣計費，價格不變", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "mom", "/me/sessions");
    const ticket = page.locator("article").first();
    await expect(ticket.getByText("已過取消期限")).toBeVisible();
    await expect(ticket.getByText(/目前\s*3\s*人/)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await ticket.getByRole("button", { name: "取消" }).click();
    await expect(ticket.getByText("臨時取消")).toBeVisible();
    await expect(ticket.getByText(/目前\s*3\s*人/)).toBeVisible();
    await expectNoErrors(errors);
  });

  test("林爸鎖定後不能減少同行家人", async ({ browser }) => {
    const { page, errors } = await loginAs(browser, "dad", "/me/sessions");
    const ticket = page.locator("article").first();
    await expect(ticket.getByRole("button", { name: "少一位家人" })).toBeDisabled();
    await expectNoErrors(errors);
  });
});
