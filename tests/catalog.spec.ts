import { test, expect, type Page } from "@playwright/test";
import { CATALOG_TIMEOUT_MS, catalogRequest } from "../src/lib/catalogRequest";

const categories = ["Women's Dress", "Men's Suit", "Perfume", "Shoes", "Accessories", "Bags", "Makeup"];
const liveProducts = categories.map((category, index) => ({
  id: `live-${index}`, name: `Live ${category}`, category, price: 1000, stock: 3,
  image_url: "/canta-5.jpg", sizes: [],
}));

async function mockCatalog(page: Page, options: { products?: typeof liveProducts; blockProducts?: () => boolean; blockStock?: boolean; failProducts?: () => boolean } = {}) {
  await page.route("**/api/storefront/region**", (route) => route.fulfill({ json: { country: "IN", currency: "INR", rate: 1, rateDate: null } }));
  await page.route("https://supabase.co.catalog-fixture.invalid/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/products")) {
      if (options.blockProducts?.()) return;
      if (options.failProducts?.()) return route.fulfill({ status: 503, json: { message: "Fixture unavailable" } });
      const needle = (url.searchParams.get("category") ?? "").replace(/^ilike\.%|%$/g, "").toLowerCase();
      return route.fulfill({ json: (options.products ?? liveProducts).filter((product) => product.category.toLowerCase().includes(needle)) });
    }
    if (url.pathname.endsWith("/product_size_stock") && options.blockStock) return;
    return route.fulfill({ json: [] });
  });
}

test('visible count follows 24, 48 and the final batch', async ({ page }) => {
  const products = Array.from({ length: 49 }, (_, index) => ({ ...liveProducts[5], id: `bag-${index}`, name: `Bag ${index}` }));
  await mockCatalog(page, { products });
  await page.goto('/bags');
  for (const count of [24, 48, 49]) {
    await expect(page.getByTestId('product-card')).toHaveCount(count);
    await expect(page.getByText(`Showing ${count} of 49 products`, { exact: true })).toBeVisible();
    if (count < 49) await page.getByRole('button', { name: 'Load more products' }).click();
  }
  await expect(page.getByRole('button', { name: 'Load more products' })).toHaveCount(0);
});

for (const method of ['card_demo', 'cash_on_delivery']) {
  test(`checkout retry after a lost response and reload retains the attempt key for ${method}`, async ({ page }) => {
    await mockCatalog(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('checkout-fixture-ready')) return;
      sessionStorage.setItem('checkout-fixture-ready', '1');
      localStorage.setItem('sb-supabase-auth-token', JSON.stringify({
        access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'fictional@example.invalid' },
      }));
      localStorage.setItem('els-cart', JSON.stringify([{ id: '22222222-2222-4222-8222-222222222222', name: 'Fixture Bag', category: 'Bags', price: 1000, image_url: '/canta-5.jpg', size: null, quantity: 1 }]));
    });
    const keys: string[] = [];
    await page.route('**/api/checkout', (route) => {
      keys.push(route.request().headers()['idempotency-key']);
      if (keys.length === 1) return route.abort('failed');
      return route.fulfill({ json: { orderId: 'saved-fixture-order', total: 1000 } });
    });
    async function fill() {
      await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Fictional Tester');
      await page.getByRole('textbox', { name: 'Phone', exact: true }).fill('000');
      await page.getByRole('textbox', { name: 'Address', exact: true }).fill('Demo address');
      await page.getByRole('textbox', { name: 'City', exact: true }).fill('Demo city');
      await page.getByRole('textbox', { name: 'Postal code', exact: true }).fill('000');
      if (method === 'cash_on_delivery') await page.getByText('Simulated cash on delivery', { exact: true }).click();
    }
    const button = () => page.getByRole('button', { name: method === 'card_demo' ? 'Simulate payment' : 'Place demo order', exact: true });
    await page.goto('/checkout');
    await fill();
    await expect(button()).toBeEnabled();
    await expect(page.getByText(/approval or decline/)).toHaveCount(0);
    await button().click();
    await expect(page.getByText(/Retry with the same details/)).toBeVisible();
    await expect(button()).toBeEnabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('els-cart') ?? '[]').length)).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem('zeouf-checkout-attempt'))).not.toContain('Fictional Tester');
    await page.reload();
    await fill();
    await button().click();
    await expect(page.getByText('Demo order saved', { exact: true })).toBeVisible();
    await expect(page.getByText(/No payment was charged, no delivery is arranged/)).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('els-cart'))).toBe('[]');
  });
}

test("all seven live categories display products instead of loading or empty copy", async ({ page }) => {
  await mockCatalog(page);
  for (const [index, route] of ["women", "men", "perfume", "shoes", "accessories", "bags", "makeup"].entries()) {
    await page.goto(`/${route}`);
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article")).toContainText(liveProducts[index].name);
    await expect(page.getByTestId("product-listing-loading")).toHaveCount(0);
    await expect(page.getByTestId("product-listing-empty")).toHaveCount(0);
  }
});

test("slow catalog uses an honest loading label then replaces it with products", async ({ page }) => {
  await mockCatalog(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route((url) => url.pathname.endsWith("/products"), async (route) => {
    await gate;
    await route.fallback();
  });
  try {
    await page.goto("/bags");
    await expect(page.getByTestId("product-listing-loading")).toContainText("Loading collection");
    await expect(page.getByText("Collection coming soon", { exact: true })).toHaveCount(0);
  } finally { release(); }
  await expect(page.locator("article")).toContainText("Live Bags");
  await expect(page.getByTestId("product-listing-loading")).toHaveCount(0);
});

test("product deadline shows identified demo fallback and retry restores the live collection", async ({ page }) => {
  let blocked = true;
  await mockCatalog(page, { blockProducts: () => blocked });
  await page.clock.install();
  const requested = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/products"));
  await page.goto("/bags");
  await requested;
  await expect(page.getByTestId("product-listing-loading")).toBeVisible();
  await page.clock.fastForward(CATALOG_TIMEOUT_MS + 1);
  await expect(page.getByRole("status").filter({ hasText: "browsing demo products" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(24);
  blocked = false;
  await page.getByRole("button", { name: "Retry collection" }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article")).toContainText("Live Bags");
  await expect(page.getByRole("button", { name: "Retry collection" })).toHaveCount(0);
});

test("stock deadline keeps loaded live products and reports unavailable size data", async ({ page }) => {
  await mockCatalog(page, { blockStock: true });
  await page.clock.install();
  const requested = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/product_size_stock"));
  await page.goto("/women");
  await requested;
  await expect(page.getByTestId("product-listing-loading")).toBeVisible();
  await page.clock.fastForward(CATALOG_TIMEOUT_MS + 1);
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article")).toContainText("Live Women's Dress");
  await expect(page.getByRole("status").filter({ hasText: "size availability could not be loaded" })).toBeVisible();
  await expect(page.getByText(/browsing demo products/)).toHaveCount(0);
});

test("server failure offers retry and a genuinely empty response stays empty", async ({ page }) => {
  let failed = true;
  await mockCatalog(page, { failProducts: () => failed, products: [] });
  await page.goto("/perfume");
  await expect(page.getByRole("button", { name: "Retry collection" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(24);
  failed = false;
  await page.getByRole("button", { name: "Retry collection" }).click();
  await expect(page.getByTestId("product-listing-empty")).toContainText("The collection is on its way.");
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry collection" })).toHaveCount(0);
});

test("cancelled or abandoned catalog requests reject without waiting for the deadline", async () => {
  const controller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  const result = catalogRequest((signal) => {
    requestSignal = signal;
    return new Promise<never>(() => {});
  }, controller.signal);
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve();
  controller.abort();
  await rejected;
  expect(requestSignal?.aborted).toBe(true);
  await expect(catalogRequest(() => Promise.resolve("unused"), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
});
