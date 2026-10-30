import { test, expect, type Page } from "@playwright/test";
import { handleAdminReviews, type AdminReviewDeps, type ReviewChange } from "../src/lib/adminReviews";

const reviewId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const review = { id: reviewId, product_id: productId, name: "Fictional Reviewer", comment: "Lovely fictional product.", rating: 4, approved: false, created_at: "2026-10-26T12:00:00Z", admin_reply: null as string | null, displayImages: [] };
const request = (body: unknown, headers = {}) => new Request("http://localhost/api/admin/reviews/" + reviewId, { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const deps = (overrides: Partial<AdminReviewDeps> = {}): AdminReviewDeps => ({
  authorize: () => "fixture-admin", rateLimit: async () => false,
  store: () => ({ list: async () => [review], update: async (_id, change) => ({ ...review, ...change }), remove: async () => true }), ...overrides,
});

test("review mutations enforce identity, origin, limiter and allowed fields before writes", async () => {
  const forbidden = () => { throw new Error("storage must not be used"); };
  expect((await handleAdminReviews(request({ approved: true }), reviewId, deps({ authorize: () => null, store: forbidden }))).status).toBe(401);
  expect((await handleAdminReviews(request({ approved: true }, { origin: "https://evil.invalid" }), reviewId, deps({ store: forbidden }))).status).toBe(403);
  expect((await handleAdminReviews(request({ approved: true }), reviewId, deps({ rateLimit: async () => true, store: forbidden }))).status).toBe(429);
  expect((await handleAdminReviews(request({ approved: true }), reviewId, deps({ rateLimit: async () => null, store: forbidden }))).status).toBe(503);
  for (const body of [{}, { approved: "true" }, { reply: " " }, { reply: "x".repeat(2001) }, { user_id: "forged", approved: true }]) {
    expect((await handleAdminReviews(request(body), reviewId, deps({ store: forbidden }))).status).toBe(400);
  }
});

test("review replies persist trimmed text, removal and moderation identity without false success", async () => {
  const changes: ReviewChange[] = [];
  const injected = deps({ store: () => ({ list: async () => [], update: async (_id, change) => { changes.push(change); return { ...review, ...change }; }, remove: async () => false }) });
  expect((await handleAdminReviews(request({ approved: true, reply: "  Thank you.  " }), reviewId, injected)).status).toBe(200);
  expect(changes[0]).toMatchObject({ approved: true, admin_reply: "Thank you.", moderated_by: "fixture-admin" });
  expect(changes[0].replied_at).toBeTruthy();
  await handleAdminReviews(request({ reply: null }), reviewId, injected);
  expect(changes[1]).toEqual({ admin_reply: null, replied_at: null });
  const failed = deps({ store: () => ({ ...injected.store()!, update: async () => { throw new Error("private database trace"); } }) });
  const response = await handleAdminReviews(request({ approved: true }), reviewId, failed);
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("private database trace");
  expect((await handleAdminReviews(new Request("http://localhost/api/admin/reviews/" + reviewId, { method: "DELETE" }), reviewId, injected)).status).toBe(404);
});

async function adminFixtures(page: Page) {
  await page.addInitScript(() => localStorage.setItem("admin_auth", "1"));
  await page.route("**/api/admin/products", route => route.fulfill({ json: { products: [] } }));
  await page.route("**/api/admin/orders", route => route.fulfill({ json: { orders: [] } }));
}

test("unified moderation preserves failed reply drafts and supports approval, replies and deletion", async ({ page }) => {
  await adminFixtures(page);
  let current = { ...review };
  let deleted = false;
  let saves = 0;
  await page.route("**/api/admin/reviews?**", route => route.fulfill({ json: { reviews: deleted ? [] : [current] } }));
  await page.route("**/api/admin/reviews/" + reviewId, route => {
    if (route.request().method() === "DELETE") { deleted = true; return route.fulfill({ json: { status: "ok" } }); }
    const change = route.request().postDataJSON();
    if ("reply" in change && saves++ === 0) return route.fulfill({ status: 503, json: { error: "Fixture save failed. Retry." } });
    current = { ...current, ...(change.approved !== undefined ? { approved: change.approved } : {}), ...("reply" in change ? { admin_reply: change.reply } : {}) };
    return route.fulfill({ json: { review: current } });
  });
  await page.goto("/admin/reviews");
  let card = page.getByRole("article", { name: "Review by Fictional Reviewer" });
  await card.getByLabel("Store reply").fill("Thank you for your feedback.");
  await card.getByRole("button", { name: "Save reply" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Fixture save failed");
  await expect(card.getByLabel("Store reply")).toHaveValue("Thank you for your feedback.");
  await card.getByRole("button", { name: "Save reply" }).click();
  await expect(card.getByText("Current store reply")).toBeVisible();
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByLabel("Review status").selectOption("all");
  card = page.getByRole("article", { name: "Review by Fictional Reviewer" });
  await expect(card.getByRole("button", { name: "Unpublish" })).toBeVisible();
  await page.reload();
  await page.getByLabel("Review status").selectOption("all");
  await expect(card.getByLabel("Store reply")).toHaveValue("Thank you for your feedback.");
  await card.getByRole("button", { name: "Remove reply" }).click();
  await expect(card.getByText("Current store reply")).toHaveCount(0);
  await card.getByRole("button", { name: "Unpublish" }).click();
  await expect(card.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Delete review" }).click();
  await card.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(card).toHaveCount(0);
});

test("profile View opens an accessible dialog and links to that customer's orders", async ({ page }) => {
  await adminFixtures(page);
  await page.route("**/api/admin/users", route => route.fulfill({ json: { users: [{ id: "fictional-customer", full_name: "Fictional Customer", updated_at: "2026-10-26" }] } }));
  await page.goto("/admin/users");
  const view = page.getByRole("button", { name: "View", exact: true });
  await view.click();
  const dialog = page.getByRole("dialog", { name: "Customer profile" });
  await expect(dialog).toContainText("Fictional Customer");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(view).toBeFocused();
  await view.click();
  await page.getByRole("button", { name: "View customer orders" }).click();
  await expect(page.getByPlaceholder("Search order ID or user ID")).toHaveValue("fictional-customer");
});

test("order details expose variants and address and offer only allowed status changes", async ({ page }) => {
  await adminFixtures(page);
  const order = { id: reviewId, user_id: "fictional-user", status: "pending", total: 2000, payment_method: "card_demo", shipping_address: { fullName: "Fictional Tester", address: "Demo address", city: "Demo city", postalCode: "000", phone: "000" }, order_items: [{ id: "line", quantity: 1, unit_price: 2000, size: "M", color: "Brown", products: { name: "Fixture Dress" } }] };
  await page.route("**/api/admin/orders", route => route.fulfill({ json: route.request().method() === "PATCH" ? { order: { ...order, status: "cancelled" } } : { orders: [order] } }));
  await page.goto("/admin/orders");
  await page.getByRole("button", { name: "View", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Order " + reviewId.slice(0, 8) });
  await expect(dialog).toContainText("Size: M"); await expect(dialog).toContainText("Color: Brown");
  await expect(dialog).toContainText("Demo address"); await expect(dialog).toContainText("Demo card");
  await expect(dialog.getByRole("option")).toHaveText(["pending", "processing", "cancelled"]);
  await dialog.getByRole("combobox", { name: "Order status" }).selectOption("cancelled");
  await expect(dialog.getByRole("combobox")).toBeDisabled();
});

test("settings report a failed catalog request instead of claiming a working connection", async ({ page }) => {
  await adminFixtures(page);
  await page.route("**/api/admin/products", route => route.fulfill({ status: 503, json: { error: "Fixture unavailable" } }));
  await page.goto("/admin/settings");
  await expect(page.getByText("Catalog connection unavailable. Refresh the dashboard to retry.")).toBeVisible();
  await expect(page.getByText("Supabase connection configured")).toHaveCount(0);
});
