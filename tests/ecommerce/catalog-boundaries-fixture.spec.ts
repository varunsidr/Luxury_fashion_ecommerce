import { test, expect, type Page } from "@playwright/test";

async function openCollection(page: Page) {
  const products = Array.from({ length: 49 }, (_, index) => ({
    id: `pagination-bag-${index}`,
    name: `Pagination Bag ${index}`,
    category: "Bags",
    brand: index < 30 ? "Matching Brand" : "Other Brand",
    sizes: index < 30 ? ["M"] : ["L"],
    stock: index < 30 ? 3 : 0,
    price: index < 30 ? 1000 : 2000,
    image_url: "/canta-5.jpg",
  }));
  await page.route("**/api/storefront/region**", (route) => route.fulfill({
    json: { country: "IN", currency: "INR", rate: 1, rateDate: null },
  }));
  await page.route("https://supabase.co.catalog-fixture.invalid/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith("/products") ? products : [] });
  });
  await page.goto("/bags");
  await expectBatch(page, 24, 49);
}

async function expectBatch(page: Page, visible: number, matching: number) {
  await expect(page.getByTestId("product-card")).toHaveCount(visible);
  await expect(page.getByText(`Showing ${visible} of ${matching} products`, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load more products" })).toHaveCount(visible < matching ? 1 : 0);
}

async function revealCollection(page: Page, matching: number) {
  for (let visible = 24; visible < matching;) {
    await page.getByRole("button", { name: "Load more products" }).click();
    visible = Math.min(visible + 24, matching);
    await expectBatch(page, visible, matching);
  }
}

test("changing a filter resets a fully revealed collection to its first batch", async ({ page }) => {
  await openCollection(page);
  await revealCollection(page, 49);
  await page.getByRole("combobox", { name: "Filter by brand" }).selectOption("Matching Brand");
  await expectBatch(page, 24, 30);
  await revealCollection(page, 30);
  await page.getByRole("combobox", { name: "Filter by brand" }).selectOption("");
  await expectBatch(page, 24, 49);
  await revealCollection(page, 49);
  await page.getByRole("combobox", { name: "Filter by brand" }).selectOption("Matching Brand");
  await expectBatch(page, 24, 30);
  await revealCollection(page, 30);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expectBatch(page, 24, 49);
});

for (const filter of ["size", "stock", "minimum price", "maximum price"] as const) {
  test(`changing ${filter} resets pagination`, async ({ page }) => {
    await openCollection(page);
    await revealCollection(page, 49);
    if (filter === "size") await page.getByRole("combobox", { name: "Filter by size" }).selectOption("M");
    if (filter === "stock") await page.getByRole("checkbox", { name: "In stock only" }).check();
    if (filter === "minimum price") await page.getByRole("slider", { name: "Minimum price" }).fill("500");
    if (filter === "maximum price") await page.getByRole("slider", { name: "Maximum price" }).fill("1500");
    const matching = filter === "minimum price" ? 49 : 30;
    await expectBatch(page, 24, matching);
    await revealCollection(page, matching);
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await expectBatch(page, 24, 49);
  });
}
