import { expect, type Page } from "@playwright/test";

/** Coleta erros de console e exceções de página para verificar ausência de erros críticos. */
export function trackConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

export async function expectQuestion(page: Page, n: number) {
  await expect(page.locator("h1")).toHaveText(`Questão ${n} de 36`);
}

export async function startAttempt(page: Page) {
  await page.goto("/avaliacao");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Iniciar avaliação" }).click();
  await page.waitForURL(/\/avaliacao\/[0-9a-f-]{36}$/);
  await expectQuestion(page, 1);
  return page.url().split("/").pop()!;
}

/** Responde à questão atual escolhendo a alternativa de índice `pick` (A=0). */
export async function answerCurrent(page: Page, pick = 0) {
  const reveal = page.getByRole("button", { name: "Mostrar conteúdo" });
  if (await reveal.isVisible().catch(() => false)) {
    await reveal.click();
    await expect(page.getByText("Memorize")).toBeVisible();
    await expect(page.getByRole("radio").first()).toBeAttached({ timeout: 20_000 });
  }
  const radios = page.getByRole("radio");
  await expect(radios.first()).toBeAttached();
  const n = await radios.count();
  await radios.nth(Math.min(pick, n - 1)).check({ force: true });
  await expect(radios.nth(Math.min(pick, n - 1))).toBeChecked();
}

export async function answerAllAndFinish(page: Page) {
  for (let i = 0; i < 36; i++) {
    await expectQuestion(page, i + 1);
    await answerCurrent(page, i % 4);
    if (i < 35) await page.getByRole("button", { name: /Próxima/ }).click();
  }
  await page.getByRole("button", { name: "Revisar e encerrar" }).click();
  const dialog = page.getByRole("dialog", { name: "Encerrar a avaliação?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("36");
  await dialog.getByRole("button", { name: "Encerrar e ver resultado" }).click();
  await page.waitForURL(/\/resultado\/[0-9a-f-]{36}$/);
}

export async function signUp(page: Page, email: string, password = "senhaForte123", name = "Pessoa Teste") {
  await page.goto("/entrar?modo=cadastro");
  await page.getByLabel("Nome de exibição").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirme a senha").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).last().click();
  await page.waitForURL(/\/perfil$/);
}

export async function signIn(page: Page, email: string, password = "senhaForte123") {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).last().click();
  await page.waitForURL(/\/perfil$/);
}
