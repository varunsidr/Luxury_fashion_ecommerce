import { defineConfig } from "@playwright/test";
import storefront from "./playwright.config";

const server = storefront.webServer;
if (!server || Array.isArray(server)) throw new Error("Expected one isolated storefront test server");

export default defineConfig({
  ...storefront,
  testMatch: "catalog.spec.ts",
  outputDir: "test-results/catalog",
  webServer: {
    ...server,
    env: {
      ...server.env,
      // Reserved .invalid domain plus mandatory browser interception: no live DB.
      // The current client configuration check requires "supabase.co" in the URL.
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.co.catalog-fixture.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "catalog-fixture-anon-key",
    },
  },
});
