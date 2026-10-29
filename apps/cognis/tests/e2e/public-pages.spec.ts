import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { trackConsole } from "./helpers";

const PUBLIC = ["/", "/como-funciona", "/avaliacao", "/metodologia", "/referencias", "/faq", "/privacidade", "/entrar", "/historico"];

test.describe("páginas públicas", () => {
  for (const path of PUBLIC) {
    test(`${path} carrega sem erros de console e sem violações graves de acessibilidade`, async ({ page }) => {
      const errors = trackConsole(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      await expect(page).toHaveTitle(/Cognis/);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test("tema claro também passa na verificação de contraste", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ativar tema claro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const axe = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => v.id === "color-contrast").flatMap((v) => v.nodes.map((n) => n.target.join(" ")))).toEqual([]);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("nenhum link interno está quebrado", async ({ page, request }) => {
    const seen = new Set<string>();
    const queue = [...PUBLIC];
    while (queue.length) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Rotas privadas redirecionam (ex.: /perfil → /entrar); usa a URL final.
      const hrefs = await page.locator("a[href^='/']").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));
      for (const h of hrefs) {
        const clean = h.split("#")[0].split("?")[0] || "/";
        if (clean.startsWith("/api/")) continue;
        if (!seen.has(clean) && !queue.includes(clean)) queue.push(clean);
      }
    }
    for (const path of seen) {
      const r = await request.get(path, { maxRedirects: 5 });
      expect(r.status(), path).toBe(200);
    }
    expect(seen.size).toBeGreaterThanOrEqual(PUBLIC.length);
  });

  test("referências mostram DOIs e âncoras usadas pela metodologia existem", async ({ page }) => {
    await page.goto("/metodologia");
    const anchors = await page.locator("a[href^='/referencias#']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!.split("#")[1]));
    expect(anchors.length).toBeGreaterThan(10);
    await page.goto("/referencias");
    for (const id of new Set(anchors)) await expect(page.locator(`[id="${id}"]`), id).toHaveCount(1);
    await expect(page.getByText("doi:10.1037/0003-066X.51.2.77")).toBeVisible();
  });

  test("layout móvel sem rolagem horizontal", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    for (const path of ["/", "/como-funciona", "/metodologia", "/avaliacao", "/faq"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.locator("#mobile-menu")).toBeVisible();
    await page.locator("#mobile-menu").getByRole("link", { name: "Metodologia" }).click();
    await expect(page).toHaveURL(/\/metodologia$/);
    await ctx.close();
  });

  test("página inexistente retorna 404 amigável", async ({ page }) => {
    const res = await page.goto("/rota-que-nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  });

  test("cabeçalhos de segurança presentes", async ({ request }) => {
    const r = await request.get("/");
    const h = r.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
