import fs from "node:fs";
import path from "node:path";
import { expect, type Browser, type Page } from "@playwright/test";

// 示範帳號密碼不寫進程式碼，執行前設定環境變數 E2E_PASSWORD
export const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!PASSWORD) throw new Error("請先設定 E2E_PASSWORD（示範帳號的密碼）");
export const USERS = {
  coach: { email: "coach@demo.jiolian.app", name: "王教練" },
  dad: { email: "dad@demo.jiolian.app", name: "林爸" },
  mom: { email: "mom@demo.jiolian.app", name: "林媽" },
  aunt: { email: "aunt@demo.jiolian.app", name: "阿姨" },
} as const;

const ART = path.join(__dirname, ".artifacts");
const STATE = path.join(ART, "state.json");

export function saveState(patch: Record<string, string>) {
  fs.mkdirSync(ART, { recursive: true });
  const cur = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};
  fs.writeFileSync(STATE, JSON.stringify({ ...cur, ...patch }, null, 2));
}

export function loadState(): Record<string, string> {
  return fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};
}

export async function shot(page: Page, name: string) {
  fs.mkdirSync(path.join(ART, "screens"), { recursive: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: path.join(ART, "screens", `${name}.png`), fullPage: true });
}

/** 在登入頁用 Email 密碼登入（會自動切到「登入」模式） */
export async function passwordLogin(page: Page, email: string) {
  await page.getByLabel("Email").waitFor();
  if (await page.getByRole("button", { name: "改用登入" }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "改用登入" }).click();
  }
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("密碼").fill(PASSWORD);
  await page.getByRole("button", { name: "登入", exact: true }).click();
}

export async function newUserPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("fonts.g")) errors.push(m.text());
  });
  return { context, page, errors };
}

export async function loginAs(browser: Browser, who: keyof typeof USERS, next = "/home") {
  const u = await newUserPage(browser);
  await u.page.goto(`/login?next=${encodeURIComponent(next)}`);
  await passwordLogin(u.page, USERS[who].email);
  await u.page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return u;
}

export async function closeAll(browser: Browser) {
  for (const c of browser.contexts()) await c.close();
}

export async function expectNoErrors(errors: string[]) {
  expect(errors, errors.join("\n")).toEqual([]);
}
