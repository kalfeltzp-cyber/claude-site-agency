import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta contra o build de produção (next start) e um
 * banco Postgres descartável (E2E_DATABASE_URL). Rode `npm run build` antes.
 */
const PORT = Number(process.env.E2E_PORT || 3200);
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL || "postgres://postgres@127.0.0.1:5432/cognis_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 420_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    // O webServer sobe antes do globalSetup (que cria o banco); espera por uma rota estática.
    url: `http://localhost:${PORT}/robots.txt`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      ADMIN_EMAILS: "admin@cognis.test",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
      COGNIS_ALLOW_LOCAL_AUTH: "true",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
});
