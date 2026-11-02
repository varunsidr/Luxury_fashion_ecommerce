import { test, expect, type Page } from "@playwright/test";
import { CATALOG_TIMEOUT_MS } from "../src/lib/catalogRequest";

const ownerA = "customer-a", ownerB = "customer-b";
const item = { id: "fixture-bag", name: "Fixture Bag", category: "Bags", price: 1000, image_url: "/canta-5.jpg", size: null, quantity: 2 };
const key = (id: string) => `els-cart:${id}`;
async function seedCart(page: Page, raw = JSON.stringify([item])) {
  await page.addInitScript(({ raw, item }) => {
    if (sessionStorage.getItem("cart-fixture-ready")) return;
    sessionStorage.setItem("cart-fixture-ready", "1");
    localStorage.setItem("els-cart:customer-a", raw);
    localStorage.setItem("els-cart:customer-b", JSON.stringify([{ ...item, name: "Other Bag", quantity: 7 }]));
    localStorage.setItem("els-cart", JSON.stringify([{ ...item, name: "Unowned Legacy Bag", quantity: 99 }]));
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify({ access_token: "fixture-access-token", refresh_token: "fixture-refresh-token", token_type: "bearer",
      expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, user: { id: "customer-a", email: "a@example.invalid", aud: "authenticated", role: "authenticated" } }));
  }, { raw, item });
}
async function customer(page: Page, id: string | null, event = id ? "SIGNED_IN" : "SIGNED_OUT") {
  await page.evaluate(({ id, event }) => {
    const session = id ? { access_token: "fixture-access-token", refresh_token: "fixture-refresh-token", token_type: "bearer",
      expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, user: { id, email: `${id}@example.invalid`, aud: "authenticated", role: "authenticated" } } : null;
    if (session) localStorage.setItem("sb-supabase-auth-token",JSON.stringify(session)); else localStorage.removeItem("sb-supabase-auth-token");
    const channel = new BroadcastChannel("sb-supabase-auth-token");
    channel.postMessage({ event,session }); channel.close();
  }, { id,event });
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/storefront/region**", route => route.fulfill({ json: { country: "IN",currency: "INR",rate: 1,rateDate: null } }));
  await page.route("https://supabase.co.catalog-fixture.invalid/**", route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith("/product_size_stock") ? [{ size: "S",stock: 0 },{ size: "M",stock: 4 },{ size: "L",stock: 1 }] : [] });
  });
});

test("saved account cart survives hydration, quantity changes and reload", async ({ page }) => {
  await seedCart(page); await page.goto("/");
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("2");
  await page.getByTestId("navbar-cart-toggle").click();
  await page.getByRole("button",{ name: "Increase quantity of Fixture Bag" }).click();
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("3");
  await page.reload();
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("3");
  await page.getByTestId("navbar-cart-toggle").click();
  await page.getByRole("button",{ name: "Remove Fixture Bag from bag" }).click();
  await expect(page.getByRole("button",{ name: "Start Shopping" })).toBeVisible();
});

test("sign-out, account switching and token refresh preserve separate bags and discard the unowned legacy bag", async ({ page }) => {
  await seedCart(page); await page.goto("/");
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("2");
  expect(await page.evaluate(() => localStorage.getItem("els-cart"))).toBeNull();
  await page.getByTestId("navbar-cart-toggle").click();
  await customer(page,null);
  await expect(page.getByTestId("navbar-cart-item")).toHaveCount(0);
  await page.getByTestId("navbar-cart-toggle").click();
  await expect(page.getByRole("button",{ name: "Start Shopping" })).toBeVisible();
  await customer(page,ownerB);
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("7");
  await customer(page,ownerB,"TOKEN_REFRESHED");
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("7");
  await page.getByTestId("navbar-cart-toggle").click();
  await expect(page.getByTestId("navbar-cart-item")).toContainText("Other Bag");
  await expect(page.getByText("Fixture Bag",{ exact: true })).toHaveCount(0);
  await page.getByRole("button",{ name: "Increase quantity of Other Bag" }).click();
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("8");
  await customer(page,ownerA);
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("2");
  await customer(page,ownerB); await page.reload();
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("8");
});

test("malformed account cart recovers with feedback and no rendering error", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror",error => errors.push(error.message));
  await seedCart(page,"{broken"); await page.goto("/");
  await page.getByTestId("navbar-cart-toggle").click();
  await expect(page.getByRole("status").filter({ hasText: "could not be restored" })).toBeVisible();
  await expect(page.getByRole("button",{ name: "Start Shopping" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("failed bag writes retain separate in-memory bags while switching accounts", async ({ page }) => {
  await seedCart(page); await page.goto("/");
  await expect(page.getByTestId("navbar-cart-count")).toHaveText("2");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key,value) { if (key.startsWith("els-cart:")) throw new DOMException("Fixture quota", "QuotaExceededError"); original.call(this,key,value); };
  });
  await page.getByTestId("navbar-cart-toggle").click();
  await page.getByRole("button",{ name: "Increase quantity of Fixture Bag" }).click();
  await expect(page.getByRole("status").filter({ hasText: "browser cannot save this bag" })).toBeVisible();
  await customer(page,ownerB); await expect(page.getByTestId("navbar-cart-count")).toHaveText("7");
  await customer(page,ownerA); await expect(page.getByTestId("navbar-cart-count")).toHaveText("3");
});

test("late checkout response cannot clear the next account's cart", async ({ page }) => {
  await seedCart(page);
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/checkout",async route => { await gate; await route.fulfill({ json: { orderId: "account-a-order",total: 2000 } }); });
  await page.goto("/checkout");
  for (const [name,value] of [["Full name","Fictional Tester"],["Phone","000"],["Address","Demo address"],["City","Demo city"],["Postal code","000"]]) await page.getByRole("textbox",{ name,exact: true }).fill(value);
  const started = page.waitForRequest("**/api/checkout");
  await page.getByRole("button",{ name: "Simulate payment",exact: true }).click(); await started;
  await customer(page,ownerB); await expect(page.getByTestId("navbar-cart-count")).toHaveText("7");
  await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveValue("");
  release();
  await expect(page.getByRole("button",{ name: "Simulate payment",exact: true })).toBeEnabled();
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]")[0].quantity,key(ownerB))).toBe(7);
  await expect(page.getByText("account-a-order",{ exact: false })).toHaveCount(0);
});

test("search errors are distinct from no matches and Retry restores deduplicated results", async ({ page }) => {
  let fail = true;
  await page.route("**/rest/v1/products**",route => fail ? route.fulfill({ status: 503,json: { message: "Fixture search failure" } }) : route.fulfill({ json: [item] }));
  await page.goto("/search?q=bag");
  await expect(page.getByRole("alert").filter({ hasText: "couldn't load search results" })).toBeVisible();
  await expect(page.getByText("No results found.")).toHaveCount(0);
  fail = false; await page.getByRole("button",{ name: "Retry search" }).click();
  await expect(page.getByText("1 results found",{ exact: false })).toBeVisible();
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await page.evaluate(() => history.pushState(null,"","/search?q=%20%20"));
  await expect(page.getByText("Enter a search term to find products.")).toBeVisible();
  await expect(page.getByTestId("product-card")).toHaveCount(0);
});

test("hung search reaches a retry state and a new query recovers", async ({ page }) => {
  let blocked = true;
  await page.route("**/rest/v1/products**",route => blocked ? undefined : route.fulfill({ json: [item] }));
  await page.clock.install();
  const started = page.waitForRequest("**/rest/v1/products**");
  await page.goto("/search?q=old"); await started;
  await page.clock.fastForward(CATALOG_TIMEOUT_MS+1);
  await expect(page.getByRole("button",{ name: "Retry search" })).toBeVisible();
  blocked = false;
  await page.evaluate(() => history.pushState(null,"","/search?q=bag"));
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await expect(page.getByText("“bag”",{ exact: false })).toBeVisible();
});

test("a late search response cannot replace the latest query or a cleared query", async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/rest/v1/products**",async route => {
    if (route.request().url().includes("old")) {
      await gate;
      await route.fulfill({ json: [{ ...item,id: "old-item",name: "Old Result" }] }).catch(() => {});
    } else await route.fulfill({ json: [item] });
  });
  const started = page.waitForRequest("**/rest/v1/products**");
  await page.goto("/search?q=old"); await started;
  await page.evaluate(() => history.pushState(null,"","/search?q=bag"));
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  release();
  await expect(page.getByTestId("product-card")).toContainText("Fixture Bag");
  await expect(page.getByText("Old Result")).toHaveCount(0);
  await page.evaluate(() => history.pushState(null,"","/search"));
  await expect(page.getByTestId("product-card")).toHaveCount(0);
});

test("sold-out size accepts an exact-size alert while in-stock size enables purchase", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const subscriptions: Record<string,unknown>[] = [];
  await page.route("**/api/restock-notifications",route => { subscriptions.push(route.request().postDataJSON()); return route.fulfill({ status: 201,json: { status: "subscribed",emailConfigured: false } }); });
  await page.goto("/women/7");
  await page.getByTestId("product-detail-size-S").click();
  await expect(page.getByTestId("product-detail-size-S")).toHaveAttribute("aria-pressed","true");
  await expect(page.getByTestId("product-detail-add-to-cart")).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByText("Get an email when size S is back.").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("size-alert-mobile.png") });
  await page.getByRole("textbox",{ name: "Email address for restock notification" }).fill("fictional@example.invalid");
  await page.getByRole("button",{ name: "Notify me",exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your request is saved" })).toBeVisible();
  expect(subscriptions).toEqual([{ productId: "7",email: "fictional@example.invalid",size: "S",color: null }]);
  await page.getByTestId("product-detail-size-M").click();
  await expect(page.getByTestId("product-detail-add-to-cart")).toBeEnabled();
  await expect(page.getByRole("button",{ name: "Notify me",exact: true })).toHaveCount(0);
});
