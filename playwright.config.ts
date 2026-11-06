import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  // Start web + worker in demo mode unless pointed at an already running server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run db:seed -- --scenario last-payment && npm run dev",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
