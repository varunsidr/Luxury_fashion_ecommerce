import { defineConfig } from "@playwright/test";
import storefront from "./playwright.config";

const server = storefront.webServer;
if (!server || Array.isArray(server)) throw new Error("Expected one isolated storefront test server");
const port = process.env.ASSISTANT_TEST_PORT ?? "3100";

export default defineConfig({
  ...storefront,
  testMatch: "assistant.spec.ts",
  outputDir: "test-results/assistant",
  use: { ...storefront.use, baseURL: `http://localhost:${port}` },
  webServer: {
    ...server,
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}/api/health`,
    env: { ...server.env, NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`, GROQ_API_KEY: "", GROQ_MODEL: "" },
  },
});
