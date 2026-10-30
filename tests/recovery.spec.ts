import { test, expect, type Page } from "@playwright/test";

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "recovery@example.invalid", aud: "authenticated", app_metadata: {}, user_metadata: {} };
const origin = "https://supabase.co.catalog-fixture.invalid";

async function recovery(page: Page, session = true) {
  await page.route("**/api/storefront/region**", route => route.fulfill({ json: { country: "IN", currency: "INR", rate: 1 } }));
  await page.route(`${origin}/**`, route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith("/user") ? user : [] }));
  if (session) await page.addInitScript(user => {
    localStorage.setItem("sb-supabase-auth-token", JSON.stringify({ access_token: "fixture-access-token", refresh_token: "fixture-refresh-token", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user }));
  }, user);
}

test("recovery validates confirmation, keeps failed input and completes password update", async ({ page }) => {
  await recovery(page);
  const updates: Record<string, unknown>[] = [];
  await page.route(`${origin}/auth/v1/user`, route => {
    if (route.request().method() !== "PUT") return route.fulfill({ json: user });
    updates.push(route.request().postDataJSON());
    return route.fulfill(updates.length === 1 ? { status: 422, json: { message: "Choose a different password.", error_code: "same_password" } } : { json: user });
  });
  await page.route(`${origin}/auth/v1/logout**`, route => route.fulfill({ json: {} }));
  await page.goto("/reset-password");
  await page.getByLabel("New password", { exact: true }).fill("A-new-password123!");
  await page.getByLabel("Confirm new password").fill("Mismatch-password!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Passwords do not match");
  expect(updates).toHaveLength(0);
  await page.getByLabel("Confirm new password").fill("A-new-password123!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Choose a different password");
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue("A-new-password123!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your password has been updated" })).toBeVisible();
  expect(updates[1]).toMatchObject({ password: "A-new-password123!" });
  expect(updates[1]).not.toHaveProperty("confirmation");
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
});

test("missing recovery session offers a fresh link with the recovery destination", async ({ page }) => {
  await recovery(page, false);
  let destination = "";
  await page.route(`${origin}/auth/v1/recover**`, route => {
    destination = new URL(route.request().url()).searchParams.get("redirect_to") ?? "";
    return route.fulfill({ json: {} });
  });
  await page.goto("/reset-password");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("invalid or has expired");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByRole("button", { name: "Send a new recovery link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  expect(destination).toBe("http://localhost:3100/reset-password");
});

test("expired session does not expose a password update form", async ({ page }) => {
  await recovery(page);
  await page.route(`${origin}/auth/v1/user`, route => route.fulfill({ status: 401, json: { message: "Expired recovery token" } }));
  await page.goto("/reset-password");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("invalid or has expired");
  await expect(page.getByRole("button", { name: "Update password" })).toHaveCount(0);
});
