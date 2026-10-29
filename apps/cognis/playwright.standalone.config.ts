import { defineConfig, devices } from "@playwright/test";

/** Testa standalone/cognis.html servido como arquivo estático (como na Vercel). */
const PORT = 3400;
export default defineConfig({
  testDir: "tests/standalone",
  timeout: 300_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx tsx scripts/build-standalone.ts && python3 -m http.server ${PORT} --directory standalone`,
    url: `http://localhost:${PORT}/cognis.html`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
