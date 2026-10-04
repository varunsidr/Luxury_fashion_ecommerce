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
