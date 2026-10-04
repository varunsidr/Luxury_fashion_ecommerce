import { test, expect, type Page } from "@playwright/test";
import { restoreCart } from "../src/lib/cartStorage";

const savedItem = { id: "fixture-bag", name: "Fixture Bag", category: "Bags", price: 1000,
  image_url: "/canta-5.jpg", size: null, quantity: 2 };

async function seedCart(page: Page, raw: string) {
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem("cart-fixture-initialized")) {
      localStorage.setItem("els-cart", value);
      sessionStorage.setItem("cart-fixture-initialized", "1");
    }
  }, raw);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/storefront/region**", (route) => route.fulfill({ json: { country: "IN", currency: "INR", rate: 1, rateDate: null } }));
});

test("cart recovery retains valid variants and rejects malformed or unsafe numeric values", () => {
  expect(restoreCart("{broken")).toEqual({ items: [], recovered: true });
  expect(restoreCart('{"not":"an array"}')).toEqual({ items: [], recovered: true });
  const result = restoreCart(JSON.stringify([savedItem, { ...savedItem, quantity: 1, color: null },
    { ...savedItem, color: "Red", quantity: 1 }, { ...savedItem, quantity: -1 },
    { ...savedItem, price: "1000" }, { ...savedItem, id: "" }, { ...savedItem, image_url: "https://unsupported.example/photo.jpg" }]));
  expect(result.recovered).toBe(true);
  expect(result.items).toHaveLength(2);
  expect(result.items[0].quantity).toBe(3);
  expect(result.items[1].color).toBe("Red");
});

test("homepage has working editorial destinations and no horizontal overflow", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A quieter kind of statement.");
  await page.getByRole("button", { name: "Show Men's Collection" }).click();
  await expect(page.getByRole("link", { name: "Explore men", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show Women's Collection" }).click();
  await expect(page.getByTestId("home-editorial-link")).toHaveCount(6);
  for (const link of await page.getByTestId("home-editorial-link").all()) {
    expect((await page.request.get((await link.getAttribute("href"))!)).ok()).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("home-desktop.png"), fullPage: true });
});

test("reduced motion uses a still poster and manual hero navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const video = page.locator("video");
  await expect(video).not.toHaveAttribute("src");
  await page.getByRole("button", { name: "Show Men's Collection" }).click();
  await expect(page.getByRole("link", { name: "Explore men", exact: true })).toHaveAttribute("href", "/men");
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
});

test("hero playback pauses explicitly and when scrolled offscreen", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("video")).toHaveCount(1);
  await page.getByRole("button", { name: "Pause collection video" }).click();
  await expect.poll(() => page.locator("video").evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await page.getByRole("button", { name: "Play collection video" }).click();
  await page.locator("footer").scrollIntoViewIfNeeded();
  expect(await page.getByTestId("home-hero").evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThan(0);
  await expect.poll(() => page.locator("video").evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
});

test("mobile navigation exposes subcategories and closes with Escape", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Show Men's Collection" }).click();
  await page.getByRole("button", { name: "Show Women's Collection" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("home-mobile.png"), fullPage: true });
  await page.getByTestId("navbar-mobile-menu-toggle").click();
  const menu = page.getByRole("dialog", { name: "Navigation menu" });
  await menu.getByText("Explore women", { exact: true }).click();
  await expect(menu.getByRole("link", { name: "Dress", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("navbar-mobile-menu-toggle")).toBeFocused();
  await expect(menu).toHaveAttribute("inert", "");
});

test("desktop mega menu can be opened and dismissed with the keyboard", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Browse women categories" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#mega-menu-women").getByRole("link", { name: "Dress", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("registration mismatch makes no account creation request; matching values continue", async ({ page }) => {
  const calls: object[] = [];
  await page.route("**/api/dev/create-user", (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ json: { status: "ok" } });
  });
  await page.goto("/");
  await page.getByTestId("navbar-account-toggle").click();
  await page.getByTestId("navbar-auth-tab-register").click();
  await page.getByTestId("navbar-register-fullname").fill("Test Customer");
  await page.getByTestId("navbar-register-email").fill("fixture@example.com");
  await page.getByTestId("navbar-register-password").fill("SamplePass123!");
  await page.getByTestId("navbar-register-confirm-password").fill("DifferentPass123!");
  await page.getByTestId("navbar-register-submit").click();
  await expect(page.getByTestId("navbar-register-error")).toContainText("Passwords do not match");
  expect(calls).toHaveLength(0);
  await page.getByTestId("navbar-register-confirm-password").fill("");
  await page.getByTestId("navbar-register-submit").click();
  expect(calls).toHaveLength(0);
  expect(await page.getByTestId("navbar-register-confirm-password").evaluate((element: HTMLInputElement) => element.validity.valueMissing)).toBe(true);
  await page.getByTestId("navbar-register-confirm-password").fill("SamplePass123!");
  await page.getByTestId("navbar-register-submit").click();
  await expect(page.getByTestId("navbar-login-form")).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]).not.toHaveProperty("confirmPassword");
  await expect(page.getByRole("status")).toContainText("Registration successful");
});

test("account drawer traps focus and restores it when dismissed", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByTestId("navbar-account-toggle");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "My account" });
  const first = dialog.getByRole("button", { name: "Close", exact: true });
  await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("saved cart survives initial hydration, quantity changes and reload", async ({ page }) => {
  await seedCart(page, JSON.stringify([savedItem]));
  await page.goto("/");
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("2");
  await page.getByTestId("navbar-cart-toggle").click();
  await expect(page.getByTestId("navbar-cart-item")).toContainText("Fixture Bag");
  await page.getByRole("button", { name: "Increase quantity of Fixture Bag" }).click();
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("3");
  await page.reload();
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("3");
  await page.getByTestId("navbar-cart-toggle").click();
  await page.getByRole("button", { name: "Remove Fixture Bag from bag" }).click();
  await expect(page.getByRole("button", { name: "Start Shopping" })).toBeVisible();
});

test("malformed cart recovers without crashing and shows feedback", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedCart(page, "{broken");
  await page.goto("/");
  await page.getByTestId("navbar-cart-toggle").click();
  await expect(page.getByRole("status")).toContainText("could not be restored");
  await expect(page.getByRole("button", { name: "Start Shopping" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("unavailable browser storage leaves a usable cart and explains persistence limits", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
    get() { throw new DOMException("Storage is unavailable", "SecurityError"); },
  }));
  await page.goto("/");
  await page.getByTestId("navbar-cart-toggle").click();
  await expect(page.getByRole("status")).toContainText("browser cannot save this bag");
  await expect(page.getByRole("button", { name: "Start Shopping" })).toBeVisible();
});

test("product card has usable keyboard actions and image failure feedback", async ({ page }, testInfo) => {
  await page.route("**/_next/image**", (route) => route.abort());
  await page.goto("/bags");
  const card = page.getByTestId("product-card").filter({ has: page.getByTestId("product-card-add-to-cart") }).first();
  await expect(card.getByText("Image unavailable")).toBeVisible();
  const action = card.getByTestId("product-card-add-to-cart");
  await action.focus();
  await expect(action).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "My account" })).toHaveAttribute("data-state", "open");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: testInfo.outputPath("catalog-desktop.png") });
});

test("sidebar logout clears the real cookie and denies subsequent admin API access", async ({ page }) => {
  await page.goto("/admin");
  await page.getByTestId("admin-login-password").fill("ui-test-admin-key");
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  expect((await page.context().cookies()).some((cookie) => cookie.name === "admin_token")).toBe(true);
  expect((await page.request.get("/api/admin/users")).status()).toBe(500);
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect((await page.context().cookies()).some((cookie) => cookie.name === "admin_token")).toBe(false);
  expect((await page.request.get("/api/admin/users")).status()).toBe(401);
  expect(await page.evaluate(() => localStorage.getItem("admin_auth"))).toBe(null);
});

test("failed logout preserves the session and offers a retry", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("admin_auth", "1"));
  await page.route("**/api/admin/logout", (route) => route.fulfill({ status: 503, json: { error: "fixture unavailable" } }));
  await page.goto("/admin/dashboard");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not sign out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem("admin_auth"))).toBe("1");
});

test("catalog stays within mobile and tablet viewports", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/bags");
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`) });
  }
});

test("browser logout redirect uses the request origin and expires the HttpOnly cookie", async ({ request }) => {
  const response = await request.get("http://127.0.0.1:3100/api/admin/logout", { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(new URL(response.headers().location, response.url()).href).toBe("http://127.0.0.1:3100/admin");
  expect(response.headers()["set-cookie"]).toContain("Max-Age=0");
  expect(response.headers()["set-cookie"]).toContain("HttpOnly");
});
