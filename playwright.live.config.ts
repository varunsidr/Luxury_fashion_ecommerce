import { defineConfig } from "@playwright/test";

const target = new URL(process.env.PLAYWRIGHT_BASE_URL || "https://zeouf-luxury-fashion-ecommerce.vercel.app");
if (!["https:", "http:"].includes(target.protocol) || target.username || target.password ||
  target.pathname !== "/" || target.search || target.hash) {
  throw new Error("PLAYWRIGHT_BASE_URL must be an HTTP(S) origin without credentials, path, query or fragment");
}

// A hosted site needs no local webServer or fixture environment overrides.
export default defineConfig({
  testDir: "./tests",
  testMatch: "live.spec.ts",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  outputDir: "test-results/live",
  use: {
    baseURL: target.origin,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
