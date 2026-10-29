import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { answerAllAndFinish, answerCurrent, expectQuestion, startAttempt, trackConsole } from "./helpers";

test.describe.serial("avaliação de ponta a ponta (sem conta)", () => {
  let attemptId = "";
  // Um único contexto para toda a série: o cookie anônimo identifica o dono da tentativa.
  let ctx: BrowserContext;
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    page = await ctx.newPage();
  });
  test.afterAll(async () => {
    await ctx.close();
  });

  test("inicia, salva respostas, sobrevive a recarga e retoma", async () => {
    const errors = trackConsole(page);
    attemptId = await startAttempt(page);

    // A API pública não expõe gabaritos nem estímulos.
    const state = await page.request.get(`/api/attempts/${attemptId}`);
    expect(state.ok()).toBeTruthy();
    const body = await state.text();
    expect(body).not.toMatch(/"answer"|explanation|isAnswer|answer_option_id/);
    expect(JSON.parse(body).items).toHaveLength(36);

    // Acessibilidade da tela de avaliação.
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

    await answerCurrent(page, 1);
    await expect(page.getByText("✓ Salvo")).toBeVisible();
    await page.getByRole("button", { name: /Próxima/ }).click();
    await expectQuestion(page, 2);
    await answerCurrent(page, 2);
    await expect(page.getByText("✓ Salvo")).toBeVisible();

    // Recarregar mantém respostas e posiciona na primeira questão sem resposta.
    await page.reload();
    await expectQuestion(page, 3);
    await page.getByRole("button", { name: "← Anterior" }).click();
    await expectQuestion(page, 2);
    await expect(page.getByRole("radio").nth(2)).toBeChecked();

    // A página de início oferece retomar a tentativa em andamento.
    await page.goto("/avaliacao");
    await expect(page.getByRole("link", { name: "Continuar avaliação" })).toHaveAttribute("href", `/avaliacao/${attemptId}`);
    expect(errors.filter((e) => !/beforeunload/i.test(e))).toEqual([]);
  });

  test("navegação por teclado seleciona alternativas", async () => {
    await page.goto(`/avaliacao/${attemptId}`);
    await expectQuestion(page, 3);
    const reveal = page.getByRole("button", { name: "Mostrar conteúdo" });
    if (await reveal.isVisible().catch(() => false)) return; // item de memória: coberto em outro teste
    await page.keyboard.press("b");
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    await page.keyboard.press("1");
    await expect(page.getByRole("radio").nth(0)).toBeChecked();
  });

  test("respostas continuam salvas mesmo com queda de conexão", async () => {
    await page.goto(`/avaliacao/${attemptId}`);
    // Abre na primeira questão sem resposta (depende do item sorteado no teste anterior).
    let n = Number((await page.locator("h1").textContent())!.match(/Questão (\d+)/)![1]);
    // Avança até uma questão comum (itens de memória exigem rede para exibir o estímulo).
    do {
      await page.getByRole("button", { name: /Próxima|Pular/ }).click();
      n++;
      await expectQuestion(page, n);
    } while (await page.getByRole("button", { name: "Mostrar conteúdo" }).isVisible());
    await ctx.setOffline(true);
    await answerCurrent(page, 0);
    await expect(page.getByText("Sem conexão — tentando")).toBeVisible();
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("✓ Salvo")).toBeVisible({ timeout: 40_000 });
    const s = await (await page.request.get(`/api/attempts/${attemptId}`)).json();
    expect(s.items[n - 1].response.optionIndex).toBe(0);
  });

  test("conclui a avaliação e exibe resultado coerente", async () => {
    const errors = trackConsole(page);
    await page.goto(`/avaliacao/${attemptId}`);
    // Volta à primeira questão e responde tudo na ordem.
    await page.getByRole("button", { name: /respondidas/ }).click();
    await page.getByRole("button", { name: /^Questão 1,/ }).click();
    await answerAllAndFinish(page);
    expect(page.url()).toContain(attemptId);

    await expect(page.getByRole("heading", { name: "Análise do seu desempenho" })).toBeVisible();
    const heroText = await page.getByText(/acertos em 36 questões/).textContent();
    const correct = Number(heroText!.match(/(\d+) acertos/)![1]);
    const index = await page.locator("text=Índice de Desempenho Cognitivo").first().locator("xpath=..").locator(".font-display").first().textContent();
    expect(Number(index!.replace(",", "."))).toBeCloseTo(Math.round((1000 * correct) / 36) / 10, 1);
    await expect(page.getByRole("heading", { name: "Desempenho por categoria" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tempo por questão" })).toBeVisible();
    await expect(page.getByText(/Ainda há apenas \d+ avaliação/)).toBeVisible();
    await expect(page.getByText(/Não é um QI/i).first()).toBeVisible();

    // Soma das categorias = 36 (dados da tabela do gráfico).
    await page.getByText("Ver dados em tabela").first().click();
    const details = await page.locator("details table").first().locator("tbody tr td:nth-child(3)").allTextContents();
    const totals = details.map((d) => Number(d.split("/")[1]));
    expect(totals.reduce((a, b) => a + b, 0)).toBe(36);

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("relatório completo mostra gabarito e explicações", async () => {
    await page.goto(`/resultado/${attemptId}/relatorio`);
    await expect(page.getByRole("heading", { name: "Revisão das questões" })).toBeVisible();
    await expect(page.getByText("Explicação:")).toHaveCount(36);
    await expect(page.getByText("gabarito", { exact: true })).toHaveCount(36);
  });

  test("tentativa encerrada não aceita novas respostas e redireciona", async () => {
    const s = await page.request.put(`/api/attempts/${attemptId}/responses`, {
      data: { questionId: "num-001", optionIndex: 0, timeSpentMs: 1 },
    });
    expect([404, 409]).toContain(s.status());
    await page.goto(`/avaliacao/${attemptId}`);
    await page.waitForURL(new RegExp(`/resultado/${attemptId}$`));
  });

  test("compartilhamento gera link anônimo acessível por terceiros e revogável", async ({ browser }) => {
    await page.goto(`/resultado/${attemptId}`);
    await page.getByRole("button", { name: "Compartilhar" }).click();
    const link = await page.getByLabel("Link de compartilhamento").inputValue();
    expect(link).toMatch(/\/r\/[A-Za-z0-9_-]+$/);

    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto(link);
    await expect(p2.getByRole("heading", { name: "Desempenho em uma avaliação Cognis" })).toBeVisible();
    await expect(p2.getByText("Explicação:")).toHaveCount(0);
    // Terceiros não acessam o resultado pelo id.
    const res = await p2.goto(`/resultado/${attemptId}`);
    expect(res?.status()).toBe(404);
    expect((await p2.request.get(`/api/attempts/${attemptId}`)).status()).toBe(404);

    await page.getByRole("button", { name: "Desativar link" }).click();
    await expect(page.getByText(/Link desativado/)).toBeVisible();
    const after = await p2.goto(link);
    expect(after?.status()).toBe(404);
    await other.close();
  });

  test("histórico anônimo lista a tentativa", async () => {
    await page.goto("/historico");
    await expect(page.getByRole("link", { name: "Ver resultado" })).toHaveAttribute("href", `/resultado/${attemptId}`);
    await expect(page.getByText("Histórico temporário")).toBeVisible();
  });
});

test("itens de memória exibem o estímulo uma única vez", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const id = await startAttempt(page);
  const state = await (await page.request.get(`/api/attempts/${id}`)).json();
  const memIndex = state.items.findIndex((i: { question: { format: string } }) => i.question.format === "memory");
  expect(memIndex).toBeGreaterThanOrEqual(0);
  const qid = state.items[memIndex].question.id;
  expect(state.items[memIndex].question.prompt).toBeNull();

  await page.getByRole("button", { name: /respondidas/ }).click();
  await page.getByRole("button", { name: new RegExp(`^Questão ${memIndex + 1},`) }).click();
  await page.getByRole("button", { name: "Mostrar conteúdo" }).click();
  await expect(page.getByText("Memorize")).toBeVisible();
  await expect(page.getByRole("radio").first()).toBeAttached({ timeout: 20_000 });
  await expect(page.getByText("Memorize")).toBeHidden();

  const again = await page.request.post(`/api/attempts/${id}/stimulus`, { data: { questionId: qid } });
  expect(again.status()).toBe(409);
  await page.reload();
  await page.getByRole("button", { name: /respondidas/ }).click();
  await page.getByRole("button", { name: new RegExp(`^Questão ${memIndex + 1},`) }).click();
  await expect(page.getByText("O conteúdo de memória já foi exibido")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mostrar conteúdo" })).toHaveCount(0);

  // Abandono pela interface.
  await page.getByRole("button", { name: /respondidas/ }).click();
  await page.getByRole("button", { name: "Abandonar esta avaliação" }).click();
  await page.getByRole("dialog", { name: "Abandonar a avaliação?" }).getByRole("button", { name: "Abandonar" }).click();
  await page.waitForURL(/\/avaliacao$/);
  await expect(page.getByRole("button", { name: "Iniciar avaliação" })).toBeVisible();
});
