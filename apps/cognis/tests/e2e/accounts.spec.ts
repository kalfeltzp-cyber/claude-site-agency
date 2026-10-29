import { expect, test } from "@playwright/test";
import { answerAllAndFinish, signIn, signUp, startAttempt } from "./helpers";

test.describe.serial("contas, histórico, isolamento e administração", () => {
  let userAResult = "";

  test("avaliação anônima é vinculada à conta criada depois", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await startAttempt(page);
    await answerAllAndFinish(page);
    userAResult = page.url().split("/").pop()!;
    await signUp(page, "ana@cognis.test", "senhaForte123", "Ana");
    await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();
    await page.goto("/historico");
    await expect(page.getByRole("link", { name: "Ver resultado" })).toHaveAttribute("href", `/resultado/${userAResult}`);
    await expect(page.getByText("Histórico temporário")).toHaveCount(0);
  });

  test("cadastro valida senha fraca e e-mail duplicado", async ({ page }) => {
    await page.goto("/entrar?modo=cadastro");
    const weak = await page.request.post("/api/auth/signup", { data: { email: "x@cognis.test", password: "123", acceptPrivacy: true } });
    expect(weak.status()).toBe(422);
    const dup = await page.request.post("/api/auth/signup", { data: { email: "ana@cognis.test", password: "outraSenha123", acceptPrivacy: true } });
    expect(dup.status()).toBe(409);
    const noConsent = await page.request.post("/api/auth/signup", { data: { email: "y@cognis.test", password: "outraSenha123" } });
    expect(noConsent.status()).toBe(422);
  });

  test("login, logout e senha incorreta", async ({ page }) => {
    await signIn(page, "ana@cognis.test");
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.waitForURL(/\/$/);
    expect((await page.request.get("/api/me").then((r) => r.json())).signedIn).toBe(false);
    const bad = await page.request.post("/api/auth/signin", { data: { email: "ana@cognis.test", password: "errada12345" } });
    expect(bad.status()).toBe(401);
    expect((await page.request.get("/perfil", { maxRedirects: 0 })).status()).toBe(307);
  });

  test("outro usuário não acessa resultados de terceiros", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signUp(page, "bruno@cognis.test", "senhaForte456", "Bruno");
    expect((await page.goto(`/resultado/${userAResult}`))?.status()).toBe(404);
    expect((await page.goto(`/resultado/${userAResult}/relatorio`))?.status()).toBe(404);
    expect((await page.request.get(`/api/attempts/${userAResult}`)).status()).toBe(404);
    expect((await page.request.post(`/api/attempts/${userAResult}/share`)).status()).toBe(404);
    // Usuário comum não acessa o painel nem a API administrativa.
    expect((await page.goto("/admin"))?.status()).toBe(404);
    expect((await page.request.get("/api/admin/export")).status()).toBe(403);
    expect((await page.request.patch("/api/admin/questions/num-001", { data: { active: false } })).status()).toBe(403);
    await ctx.close();
  });

  test("requisições de outra origem são rejeitadas", async ({ request }) => {
    const r = await request.post("/api/attempts", { data: { consent: true }, headers: { Origin: "https://evil.example" } });
    expect(r.status()).toBe(403);
  });

  test("administrador vê métricas agregadas, gerencia questões e exporta", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await signUp(page, "admin@cognis.test", "senhaAdmin789", "Admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await expect(page.locator("text=Usuários").locator("xpath=..")).toContainText("3");
    const html = await page.content();
    expect(html).not.toContain("ana@cognis.test");

    await page.goto("/admin/questoes?categoria=numerico");
    await expect(page.getByRole("cell", { name: "num-001v1" })).toBeVisible();
    const toggle = page.getByRole("switch", { name: "Desativar questão num-001" });
    await toggle.click();
    await expect(page.getByRole("switch", { name: "Ativar questão num-001" })).toBeVisible();
    await page.getByRole("switch", { name: "Ativar questão num-001" }).click();
    await expect(page.getByRole("switch", { name: "Desativar questão num-001" })).toBeVisible();

    await page.goto("/admin/questoes/num-001");
    await page.getByLabel("Notas de qualidade").fill("Revisado no teste E2E.");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText(/Salvo \(versão 2\)/)).toBeVisible();

    // Validação no servidor: gabarito inexistente é rejeitado.
    const bad = await page.request.put("/api/admin/questions/num-001", { data: { id: "num-001", category: "numerico", difficulty: 1, format: "text", prompt: "Pergunta teste?", options: [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" }, { id: "d", text: "4" }], answer: "z", explanation: "Explicação longa o bastante.", rationale: "Justificativa.", recommendedSeconds: 30 } });
    expect(bad.status()).toBe(422);

    const exp = await page.request.get("/api/admin/export?format=json");
    expect(exp.status()).toBe(200);
    const text = await exp.text();
    expect(text).not.toMatch(/@cognis\.test/);
    expect(JSON.parse(text).items.length).toBe(77);
    const csv = await page.request.get("/api/admin/export?format=csv");
    expect((await csv.text()).split("\n")[0]).toContain("question_id");

    for (const p of ["/admin/categorias", "/admin/versoes", "/admin/referencias", "/admin/questoes/nova"]) {
      expect((await page.goto(p))?.status(), p).toBe(200);
    }
  });

  test("titular exporta e exclui a conta com todos os dados", async ({ page }) => {
    await signIn(page, "ana@cognis.test");
    const exp = await page.request.get("/api/account/export");
    expect(exp.status()).toBe(200);
    const data = await exp.json();
    expect(data.account.email).toBe("ana@cognis.test");
    expect(data.results.length).toBeGreaterThanOrEqual(1);

    await page.getByRole("button", { name: "Excluir conta e dados" }).click();
    const dialog = page.getByRole("dialog", { name: "Excluir conta definitivamente?" });
    await dialog.getByRole("textbox").fill("EXCLUIR");
    await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();
    await page.waitForURL(/\/\?conta=excluida$/);
    const login = await page.request.post("/api/auth/signin", { data: { email: "ana@cognis.test", password: "senhaForte123" } });
    expect(login.status()).toBe(401);
  });
});
