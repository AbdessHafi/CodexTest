import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e-db",
  globalSetup: "./tests/fixtures/setup.ts",
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "npx tsx tests/fixtures/services.ts",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 3002",
      url: "http://127.0.0.1:3002",
      reuseExistingServer: false,
      env: {
        DEMO_MODE: "false",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3002",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
        CAPTCHA_MODE: "disabled",
        S3_ENDPOINT: "http://127.0.0.1:54329",
        S3_BUCKET: "test-private",
        S3_REGION: "eu-west-3",
        S3_ACCESS_KEY_ID: "fixture-access",
        S3_SECRET_ACCESS_KEY: "fixture-secret",
      },
    },
  ],
});
