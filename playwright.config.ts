import { defineConfig } from "@playwright/test";

// Always launch a dedicated local server with nonproduction fixture settings.
// Never reuse a server that might be connected to the user's actual database.
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  workers: 1,
  retries: 0,
  reporter: "list",
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
      NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "your-anon-key",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
      SUPABASE_SERVICE_ROLE_KEY: "",
      DEV_CREATE_USER_KEY: "ui-test-admin-key",
      DEV_ADMIN_USERNAME: "",
      RESEND_API_KEY: "",
      RESTOCK_FROM_EMAIL: "",
      TEST_API_SECRET: "",
    },
  },
});
