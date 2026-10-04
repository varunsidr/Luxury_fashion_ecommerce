import { test, expect, type Page } from "@playwright/test";

const blockedRequests: string[] = [];

test.beforeEach(async ({ context }) => {
  blockedRequests.length = 0;
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) ||
      /^\/api\/(?:admin\/logout|test\/|dev\/)/.test(url.pathname)) {
      blockedRequests.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }
    return route.continue();
  });
});

test.afterEach(() => {
  expect(blockedRequests, "Public smoke checks must not attempt state-changing requests").toEqual([]);
});

async function collection(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.ok()).toBe(true);
  await expect(page.getByTestId("product-listing-grid")).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.getByTestId("product-listing-loading")).toHaveCount(0);
  await expect(page.getByTestId("product-listing-empty")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry collection" })).toHaveCount(0);
}

test("deployed homepage and collection links load", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A quieter kind of statement.");
  await page.getByRole("button", { name: "Show Men's Collection" }).click();
  await expect(page.getByRole("link", { name: "Explore men", exact: true })).toHaveAttribute("href", "/men");
  await expect(page.getByTestId("home-editorial-link")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [path, heading] of [
  ["women", "Women"], ["men", "Men"], ["perfume", "Perfume"], ["shoes", "Shoes"],
  ["accessories", "Accessories"], ["bags", "Bags"], ["makeup", "Makeup"],
]) {
  test(`deployed ${path} collection shows live products`, async ({ page }) => {
    await collection(page, `/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  });
}

test("deployed search returns products", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("navbar-search-toggle").click();
  await page.getByTestId("navbar-search-input").fill("perfume");
  await page.getByTestId("navbar-search-input").press("Enter");
  await expect(page).toHaveURL(/\/search\?q=perfume$/);
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.getByText("No results found.", { exact: true })).toHaveCount(0);
});

test("deployed product card opens the matching product detail", async ({ page }) => {
  await collection(page, "/bags");
  const card = page.locator("article").first();
  const name = await card.locator("h3").innerText();
  await card.locator("a[href]").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(page.getByTestId("product-detail-quantity-value")).toHaveText("1");
});

test("deployed mobile navigation opens a clothing collection", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByTestId("navbar-mobile-menu-toggle").click();
  const menu = page.getByRole("dialog", { name: "Navigation menu" });
  await menu.getByText("Explore women", { exact: true }).click();
  await menu.getByRole("link", { name: "Dress", exact: true }).click();
  await expect(page).toHaveURL(/\/women\/dress$/);
  await expect(page.getByTestId("product-listing-grid")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("deployed public information pages are accessible", async ({ page }) => {
  for (const path of ["/privacy", "/terms"]) {
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("deployed admin login renders without submitting credentials", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByTestId("admin-login-password")).toBeVisible();
  await expect(page.getByTestId("admin-login-submit")).toBeDisabled();
});
