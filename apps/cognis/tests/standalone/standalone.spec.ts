import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const URL = "/cognis.html";

interface Q { id: string; format: string; answer: string; category: string }
interface Attempt { items: { qid: string; order: string[] }[]; responses: Record<string, { sel: string | null }>; deadline: number; memShown: Record<string, boolean> }

async function bank(page: Page): Promise<Record<string, Q>> {
  const data = await page.evaluate(() => JSON.parse(document.getElementById("cognis-data")!.textContent!));
  return Object.fromEntries(data.questions.map((q: Q) => [q.id, q]));
}
async function stored(page: Page): Promise<{ current: Attempt | null; history: { score: { correct: number; total: number; index: number; unanswered: number } }[] }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("cognis-local-v1") || '{"current":null,"history":[]}'));
}
async function start(page: Page) {
  await page.goto(URL);
  await expect(page.getByRole("button", { name: "Iniciar avaliação" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Iniciar avaliação" }).click();
  await expect(page.locator("#qh")).toHaveText("Questão 1 de 36");
}
async function seriousA11y(page: Page, tags = ["wcag2a", "wcag2aa"]) {
  const axe = await new AxeBuilder({ page }).withTags(tags).analyze();
  return axe.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " " + (n.failureSummary ?? "").split("\n")[1]).join(" | ")}`);
}
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return errors;
}

test("página inicial sem erros, acessível e sem QI inventado", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(URL);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Teste seu raciocínio");
  await expect(page.getByText("Por que não aparece um “QI”?")).toBeVisible();
  expect(await seriousA11y(page)).toEqual([]);
  await page.locator("#theme").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const axeLight = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  expect(axeLight.violations.filter((v) => v.id === "color-contrast").length).toBe(0);
  expect(errors).toEqual([]);
});

test("prova completa: sorteio válido, correção exata, recarga, memória única e relatório", async ({ page }) => {
  const errors = trackErrors(page);
  const Q = await (async () => { await page.goto(URL); return bank(page); })();
  await start(page);
  let s = await stored(page);
  const at = s.current!;
  expect(at.items).toHaveLength(36);
  expect(new Set(at.items.map((i) => i.qid)).size).toBe(36);
  const perCat: Record<string, number> = {};
  for (const it of at.items) perCat[Q[it.qid].category] = (perCat[Q[it.qid].category] ?? 0) + 1;
  expect(Object.keys(perCat)).toHaveLength(10);

  // Plano: acerta posições pares, erra ímpares, deixa a posição 5 em branco.
  let expectedCorrect = 0;
  let reloaded = false;
  for (let i = 0; i < 36; i++) {
    await expect(page.locator("#qh")).toHaveText(`Questão ${i + 1} de 36`);
    const it = at.items[i];
    const q = Q[it.qid];
    if (q.format === "memory") {
      await page.getByRole("button", { name: "Mostrar conteúdo" }).click();
      await expect(page.getByText("Memorize")).toBeVisible();
      await expect(page.getByRole("radio").first()).toBeAttached({ timeout: 20_000 });
    }
    if (i !== 5) {
      const correctIdx = it.order.indexOf(q.answer);
      const idx = i % 2 === 0 ? correctIdx : (correctIdx + 1) % it.order.length;
      if (i % 2 === 0) expectedCorrect++;
      if (i === 3) await page.keyboard.press(String.fromCharCode(65 + idx)); // atalho de teclado
      else await page.getByRole("radio").nth(idx).check({ force: true });
      await expect(page.getByRole("radio").nth(idx)).toBeChecked();
    }
    if (!reloaded && i === 8) {
      // Recarga no meio: respostas e posição preservadas.
      reloaded = true;
      await page.reload();
      await page.getByRole("button", { name: "Continuar avaliação" }).click();
      // Retoma exatamente onde parou, com a resposta marcada.
      await expect(page.locator("#qh")).toHaveText("Questão 9 de 36");
      await expect(page.getByRole("radio").nth(at.items[8].order.indexOf(Q[at.items[8].qid].answer))).toBeChecked();
      await page.getByRole("button", { name: /respondidas/ }).click();
      await expect(page.getByRole("button", { name: "Questão 6, sem resposta" })).toBeVisible();
      await page.getByRole("button", { name: "Questão 9, respondida" }).click();
    }
    if (i < 35) await page.getByRole("button", { name: /Próxima|Pular/ }).click();
  }
  // Estímulos de memória marcados como exibidos (não reaparecem).
  s = await stored(page);
  for (const it of at.items.filter((x) => Q[x.qid].format === "memory")) expect(s.current!.memShown[it.qid]).toBe(true);

  await page.getByRole("button", { name: "Revisar e encerrar" }).click();
  await expect(page.locator("#dlg-finish")).toContainText("35");
  await page.getByRole("button", { name: "Encerrar e ver resultado" }).click();
  await expect(page.getByRole("heading", { name: "Análise do seu desempenho" })).toBeVisible();

  const expectedIndex = Math.round((1000 * expectedCorrect) / 36) / 10;
  await expect(page.getByText(`${expectedCorrect} acertos em 36 questões`)).toBeVisible();
  await expect(page.locator(".big")).toHaveText(expectedIndex.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
  s = await stored(page);
  expect(s.current).toBeNull();
  expect(s.history[0].score).toMatchObject({ correct: expectedCorrect, total: 36, unanswered: 1, index: expectedIndex });

  await page.getByRole("button", { name: "Ver relatório completo (gabarito)" }).click();
  await expect(page.getByText("Explicação:")).toHaveCount(36);
  await expect(page.locator(".tag.good", { hasText: "gabarito" })).toHaveCount(36);
  expect(await seriousA11y(page)).toEqual([]);

  // Histórico persiste após recarregar.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Seu histórico" })).toBeVisible();
  await page.getByRole("button", { name: "Ver" }).first().click();
  await expect(page.getByText(`${expectedCorrect} acertos em 36 questões`)).toBeVisible();
  expect(errors).toEqual([]);
});

test("memória não é reapresentada após recarregar", async ({ page }) => {
  await page.goto(URL);
  const Q = await bank(page);
  await start(page);
  const at = (await stored(page)).current!;
  const memIdx = at.items.findIndex((i) => Q[i.qid].format === "memory");
  await page.getByRole("button", { name: /respondidas/ }).click();
  await page.getByRole("button", { name: new RegExp(`^Questão ${memIdx + 1},`) }).click();
  await page.getByRole("button", { name: "Mostrar conteúdo" }).click();
  await expect(page.getByText("Memorize")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continuar avaliação" }).click();
  await page.getByRole("button", { name: /respondidas/ }).click();
  await page.getByRole("button", { name: new RegExp(`^Questão ${memIdx + 1},`) }).click();
  await expect(page.getByText("O conteúdo de memória já foi exibido")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mostrar conteúdo" })).toHaveCount(0);
});

test("tempo esgotado encerra e pontua o que foi respondido", async ({ page, context }) => {
  await page.goto(URL);
  const Q = await bank(page);
  await start(page);
  const at = (await stored(page)).current!;
  const first = at.items[0];
  await page.getByRole("radio").nth(first.order.indexOf(Q[first.qid].answer)).check({ force: true });
  await page.close(); // fecha sem disparar beforeunload
  const next = await context.newPage();
  // Simula a volta depois do prazo: o prazo salvo já passou quando a página abre.
  await next.addInitScript(() => {
    const d = JSON.parse(localStorage.getItem("cognis-local-v1") || "null");
    if (d?.current) { d.current.deadline = Date.now() - 1000; localStorage.setItem("cognis-local-v1", JSON.stringify(d)); }
  });
  await next.goto(URL);
  page = next;
  await expect(page.getByText("Tempo esgotado.")).toBeVisible();
  await expect(page.getByText("1 acerto em 36 questões")).toBeVisible();
});

test("abandonar descarta a tentativa sem gerar resultado", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: /respondidas/ }).click();
  await page.getByRole("button", { name: "Abandonar esta avaliação" }).click();
  await page.locator("#dlg-abandon-ok").click();
  await expect(page.getByRole("button", { name: "Iniciar avaliação" })).toBeVisible();
  const s = await stored(page);
  expect(s.current).toBeNull();
  expect(s.history).toHaveLength(0);
});

test("celular: sem rolagem horizontal na prova e no resultado", async ({ browser }) => {
  // Sem isMobile: a emulação móvel reduz o zoom e esconderia um estouro de largura.
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  const page = await ctx.newPage();
  await start(page);
  const Q = await bank(page);
  const at = (await stored(page)).current!;
  const idxs = [0, ...["matrix", "sequence", "figure_choice"].map((f) => at.items.findIndex((i) => Q[i.qid].format === f))].filter((i) => i >= 0);
  expect(idxs.length).toBeGreaterThanOrEqual(2);
  for (const idx of idxs) {
    await page.getByRole("button", { name: /respondidas/ }).click();
    await page.getByRole("button", { name: new RegExp(`^Questão ${idx + 1},`) }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
  await page.getByRole("button", { name: "Encerrar" }).click();
  await page.getByRole("button", { name: "Encerrar e ver resultado" }).click();
  await page.getByRole("button", { name: "Ver relatório completo (gabarito)" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await ctx.close();
});
