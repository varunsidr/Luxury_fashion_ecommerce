import { defineConfig } from "@playwright/test";

// Always launch a dedicated local server with nonproduction fixture settings.
// Never reuse a server that might be connected to the user's actual database.
export default defineConfig({
  testDir: "./tests",
  testMatch: "storefront.spec.ts",
  timeout: 30_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/storefront",
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ISOLATED_BROWSER_TESTS: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "your-anon-key",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
      SUPABASE_SERVICE_ROLE_KEY: "",
      ADMIN_CREDENTIALS: '{"test-admin":"scrypt:00000000000000000000000000000000:5b30bd6597272cab6a6bc1af3c99213f4f80978db8f8a38d3e0aaf03f1f64882a311fe99743078d645ddbc926ce3e91d69e6c8b558225fd9057e0f0c236d113a"}',
      ADMIN_SESSION_SECRET: "fixture-admin-session-secret-32-characters",
      DEV_CREATE_USER_KEY: "ui-test-admin-key",
      DEV_ADMIN_USERNAME: "",
      RESEND_API_KEY: "",
      RESTOCK_FROM_EMAIL: "",
      TEST_API_SECRET: "",
    },
  },
});
