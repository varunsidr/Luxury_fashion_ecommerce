import { test, expect, type Page } from "@playwright/test";
import { handleCatalog, handleProductUpload, validateProduct, type AdminCatalogDeps } from "../src/lib/adminCatalog";
import { POST as adminLogin } from "../src/app/api/admin/login/route";
import { POST as createDevUser } from "../src/app/api/dev/create-user/route";
import { signToken, verifyToken } from "../src/lib/adminAuth";

async function withAuthEnvironment(overrides: Record<string, string>, run: () => Promise<void>) {
  const values = {
    NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://supabase.co.auth-fixture.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key", RATE_LIMIT_SECRET: "",
    DEV_CREATE_USER_KEY: "fixture-helper-key", ADMIN_CREDENTIALS: "",
    ADMIN_SESSION_SECRET: "fixture-independent-admin-signing-secret", ...overrides,
  };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { await run(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("dev helper is disabled when its key is missing or blank", async () => {
  for (const key of ["", "   "]) await withAuthEnvironment({ DEV_CREATE_USER_KEY: key }, async () => {
    expect((await createDevUser(new Request("http://localhost/api/dev/create-user", { method: "POST" }))).status).toBe(503);
  });
});

test("dev helper requires its own key before processing account input", async () => {
  await withAuthEnvironment({}, async () => {
    for (const key of ["", "wrong-key"]) {
      const response = await createDevUser(new Request("http://localhost/api/dev/create-user", { method: "POST", headers: { "x-dev-key": key } }));
      expect(response.status).toBe(401);
    }
    const response = await createDevUser(new Request("http://localhost/api/dev/create-user", { method: "POST", headers: { "x-dev-key": "fixture-helper-key" } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "email and password required" });
  });
});

test("production rejects dev creation even with the correct helper key", async () => {
  await withAuthEnvironment({ NODE_ENV: "production" }, async () => {
    const response = await createDevUser(new Request("http://localhost/api/dev/create-user", { method: "POST", headers: { "x-dev-key": "fixture-helper-key" } }));
    expect(response.status).toBe(403);
  });
});

test("dev helper key cannot replace named admin credentials", async () => {
  await withAuthEnvironment({}, async () => {
    const response = await adminLogin(new Request("http://localhost/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "helper-key-admin-test", password: "fixture-helper-key" }),
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

test("admin cookies require an independent signing secret in development too", async () => {
  const formerSharedSecret = "fixture-former-shared-secret-at-least-32-characters";
  await withAuthEnvironment({ ADMIN_SESSION_SECRET: formerSharedSecret, DEV_CREATE_USER_KEY: formerSharedSecret }, async () => {
    const oldToken = signToken({ adminId: "fixture-admin" });
    for (const secret of ["", "too-short"]) {
      process.env.ADMIN_SESSION_SECRET = secret;
      expect(() => signToken({ adminId: "fixture-admin" })).toThrow("Missing ADMIN_SESSION_SECRET");
      expect(verifyToken(oldToken)).toBeNull();
    }
  });
});

const id = "11111111-1111-4111-8111-111111111111";
const input = { name: "Fixture Bag", category: "Bags", price: 1500.25, stock: 3, description: "Fictional fixture", sizes: [], image_url: "/canta-5.jpg", images: ["/canta-5.jpg"] };
const request = (method: string, body: unknown = input, headers = {}) => new Request("http://localhost/api/admin/products", {
  method, headers: { "Content-Type": "application/json", ...headers }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
});
const deps = (over: Partial<AdminCatalogDeps> = {}): AdminCatalogDeps => ({ authorize: () => "fixture-admin", rateLimit: async () => false,
  store: () => ({ list: async () => [], save: async (id, product) => ({ id, ...product }), remove: async () => true, upload: async () => "/fixture.png" }), ...over });

test("catalog input rejects invalid money, stock, options and executable image URLs", () => {
  expect(validateProduct(input)).toEqual(input);
  for (const over of [{ name: " " }, { price: NaN }, { price: -1 }, { price: 1.234 }, { price: "10" }, { stock: true }, { stock: 0.5 }, { stock: 2147483648 },
    { sizes: ["M","M"] }, { sizes: ["invalid"] }, { category: "invalid" }, { image_url: "javascript:alert(1)" }, { images: ["//evil.test/photo.png"] }]) {
    expect(validateProduct({ ...input, ...over })).toBeNull();
  }
});

test("catalog API denies identity/origin/limiter failures before storage access", async () => {
  const unavailable = () => { throw new Error("must not access storage"); };
  expect((await handleCatalog(request("POST"), null, deps({ authorize: () => null, store: unavailable }))).status).toBe(401);
  expect((await handleCatalog(request("POST", input, { origin: "https://evil.test" }), null, deps({ store: unavailable }))).status).toBe(403);
  expect((await handleCatalog(request("POST"), null, deps({ rateLimit: async () => true, store: unavailable }))).status).toBe(429);
  expect((await handleCatalog(request("POST"), null, deps({ rateLimit: async () => null, store: unavailable }))).status).toBe(503);
  expect((await handleCatalog(request("PATCH"), "bad-id", deps({ store: unavailable }))).status).toBe(400);
  expect((await handleCatalog(request("POST", { ...input, price: -1 }), null, deps({ store: unavailable }))).status).toBe(400);
});

test("catalog saves only validated fields and reports missing products and database failures safely", async () => {
  const created = await handleCatalog(request("POST", { ...input, secret: "do-not-store", approved: true }), null, deps());
  expect(created.status).toBe(201); expect((await created.json()).product).not.toHaveProperty("secret");
  expect((await handleCatalog(request("PATCH"), id, deps())).status).toBe(200);
  expect((await handleCatalog(request("DELETE"), id, deps({ store: () => ({ ...deps().store()!, remove: async () => false }) }))).status).toBe(404);
  const failure = await handleCatalog(request("POST"), null, deps({ store: () => ({ ...deps().store()!, save: async () => { throw new Error("private-key database trace"); } }) }));
  expect(failure.status).toBe(503); expect(JSON.stringify(await failure.json())).not.toContain("private-key");
});

test("product upload validates format bytes and size before storage", async () => {
  const upload = (bytes: Uint8Array, type: string) => { const form = new FormData(); form.append("image", new File([bytes as Uint8Array<ArrayBuffer>], "untrusted.svg", { type })); return new Request("http://localhost/api/admin/products/upload", { method: "POST", body: form }); };
  expect((await handleProductUpload(upload(new Uint8Array([137,80,78,71,13,10,26,10]), "image/png"), deps())).status).toBe(201);
  expect((await handleProductUpload(upload(new Uint8Array([1,2,3]), "image/png"), deps())).status).toBe(400);
  expect((await handleProductUpload(upload(new Uint8Array([1,2,3]), "image/svg+xml"), deps())).status).toBe(400);
  expect((await handleProductUpload(upload(new Uint8Array(2 * 1024 * 1024 + 1), "image/png"), deps())).status).toBe(400);
  expect((await handleProductUpload(upload(new Uint8Array([1]), "image/png"), deps({ authorize: () => null }))).status).toBe(401);
});

test("actual product routes require a signed admin session independent of browser flags", async ({ request }) => {
  expect((await request.get("/api/admin/products")).status()).toBe(401);
  expect((await request.post("/api/admin/products", { data: input })).status()).toBe(401);
  await request.post("/api/admin/login", { data: { username: "test-admin", password: "ui-test-admin-key" } });
  expect((await request.get("/api/admin/products")).status()).toBe(503);
  expect((await request.post("/api/admin/products", { data: { ...input, stock: -1 } })).status()).toBe(400);
  expect((await request.post("/api/admin/products", { data: input, headers: { origin: "https://evil.test" } })).status()).toBe(403);
});

async function dashboard(page: Page, products = [{ id, ...input, created_at: "2026-10-01", product_size_stock: [] }]) {
  await page.addInitScript(() => localStorage.setItem("admin_auth", "1"));
  await page.route("**/api/admin/products", route => route.fulfill({ json: { products } }));
  await page.route("**/api/admin/orders", route => route.fulfill({ json: { orders: [
    { id: "active-order", status: "pending", total: 1000, placed_at: "2026-10-01", order_items: [] },
    { id: "cancelled-order", status: "cancelled", total: 5000, placed_at: "2026-10-02", order_items: [] },
  ] } }));
  await page.route("**/api/admin/reviews?**", route => route.fulfill({ json: { reviews: [
    { id: "approved", rating: 4, approved: true }, { id: "pending", rating: 1, approved: false },
  ] } }));
  await page.goto("/admin/dashboard");
}

test("dashboard counts unsized low stock and excludes cancelled demo value and unapproved ratings", async ({ page }) => {
  await dashboard(page);
  await expect(page.getByText("Low Stock", { exact: true }).locator("..").locator("..")).toContainText("1");
  await expect(page.getByText("Active demo order value", { exact: true }).locator("..")).toContainText("1,000");
  await page.getByRole("button", { name: /Pending orders/ }).click();
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("pending");
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Customer signal", exact: true }) })).toContainText("4.0");
  await expect(page.getByText("1 approved reviews")).toBeVisible();
});

test("failed product save preserves the form and supports a successful retry", async ({ page }) => {
  await dashboard(page);
  await page.getByRole("button", { name: "Add a product", exact: true }).click();
  await page.getByPlaceholder("Product name", { exact: true }).fill("Retry Product");
  await page.getByLabel("Product price").fill("1000");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.getByLabel("Overall stock")).toBeDisabled();
  let writes = 0;
  await page.route("**/api/admin/products", route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { products: [] } });
    writes++;
    return route.fulfill(writes === 1 ? { status: 503, json: { error: "Fixture save failed" } } : { status: 201, json: { product: { id, ...input } } });
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Fixture save failed" })).toBeVisible();
  await expect(page.getByPlaceholder("Product name", { exact: true })).toHaveValue("Retry Product");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add New Product" })).toHaveCount(0);
  expect(writes).toBe(2);
});

test("dashboard reports unavailable catalog data instead of showing zero inventory as success", async ({ page }) => {
  await dashboard(page);
  await page.route("**/api/admin/products", route => route.fulfill({ status: 503, json: { error: "Fixture catalog unavailable" } }));
  await page.getByRole("button", { name: "Refresh dashboard" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Fixture catalog unavailable" })).toBeVisible();
  await expect(page.getByText("Total Products", { exact: true }).locator("..").locator("..")).toContainText("—");
  await expect(page.getByRole("button", { name: "Retry loading data" })).toBeVisible();
});
