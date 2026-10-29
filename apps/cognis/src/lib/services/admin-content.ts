import { db, tx } from "../db/pool";
import { blueprintShortfalls } from "../engine/selection";
import { categorySchema, questionSchema, testVersionSchema, type Question } from "../questions/schema";
import { AppError, notFound } from "../security/errors";
import {
  activateTestVersion,
  auditLog,
  getQuestionsByIds,
  insertTestVersion,
  listCategories,
  listSelectableQuestions,
  setQuestionActive,
  upsertCategory,
  upsertQuestion,
} from "./content-repo";

/** Operações administrativas de conteúdo, sempre com validação e trilha de auditoria. */

function validationError(issues: { path: PropertyKey[]; message: string }[]) {
  return new AppError(422, "validation_error", issues.map((i) => `${i.path.map(String).join(".") || "questão"}: ${i.message}`).join("; "));
}

export async function saveQuestion(actorId: string, raw: unknown, mode: "create" | "update", id?: string): Promise<Question> {
  const parsed = questionSchema.safeParse(raw);
  if (!parsed.success) throw validationError(parsed.error.issues);
  const question = parsed.data;
  if (mode === "update" && question.id !== id) throw new AppError(422, "id_mismatch", "O id não pode ser alterado.");
  const categories = await listCategories(db, true);
  if (!categories.some((c) => c.id === question.category)) throw new AppError(422, "unknown_category", "Categoria inexistente.");

  return tx(async (q) => {
    const existing = await getQuestionsByIds(q, [question.id]);
    if (mode === "create" && existing.size) throw new AppError(409, "duplicate_id", "Já existe uma questão com este id.");
    if (mode === "update" && !existing.size) throw notFound("Questão");
    // Edições de conteúdo incrementam a versão do item para rastreabilidade.
    const prev = existing.get(question.id);
    const next = prev ? { ...question, version: Math.max(question.version, prev.version + 1) } : question;
    await upsertQuestion(q, next, { overwrite: true });
    await auditLog(q, actorId, mode === "create" ? "question.create" : "question.update", "question", question.id, { version: next.version });
    return next;
  });
}

export async function toggleQuestion(actorId: string, id: string, active: boolean) {
  await tx(async (q) => {
    if (!(await setQuestionActive(q, id, active))) throw notFound("Questão");
    await auditLog(q, actorId, active ? "question.activate" : "question.deactivate", "question", id);
  });
}

export async function saveCategory(actorId: string, raw: unknown) {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) throw validationError(parsed.error.issues);
  await tx(async (q) => {
    await upsertCategory(q, parsed.data, { overwrite: true });
    await auditLog(q, actorId, "category.save", "category", parsed.data.id);
  });
}

export async function createTestVersion(actorId: string, raw: unknown) {
  const parsed = testVersionSchema.safeParse({ ...(raw as object), status: "draft" });
  if (!parsed.success) throw validationError(parsed.error.issues);
  const v = parsed.data;
  const bank = await listSelectableQuestions(db);
  const short = blueprintShortfalls(
    bank.map((b) => ({ id: b.id, category: b.category, difficulty: b.difficulty, optionIds: b.option_ids })),
    v.blueprint,
  );
  if (short.length) {
    throw new AppError(
      422,
      "blueprint_infeasible",
      `A matriz exige mais itens do que o banco ativo possui: ${short.map((s) => `${s.category}/nível ${s.difficulty} (${s.available}/${s.required})`).join(", ")}`,
    );
  }
  await tx(async (q) => {
    const exists = await q.query("select 1 from public.test_versions where id = $1", [v.id]);
    if (exists.length) throw new AppError(409, "duplicate_id", "Já existe uma versão com este id.");
    await insertTestVersion(q, v, { ignoreExisting: false });
    await auditLog(q, actorId, "version.create", "test_version", v.id);
  });
}

export async function activateVersion(actorId: string, id: string) {
  await tx(async (q) => {
    const rows = await q.query<{ blueprint: Parameters<typeof blueprintShortfalls>[1] }>("select blueprint from public.test_versions where id = $1", [id]);
    if (!rows[0]) throw notFound("Versão");
    const bank = await listSelectableQuestions(q);
    const short = blueprintShortfalls(
      bank.map((b) => ({ id: b.id, category: b.category, difficulty: b.difficulty, optionIds: b.option_ids })),
      rows[0].blueprint,
    );
    if (short.length) throw new AppError(422, "blueprint_infeasible", "O banco ativo não atende à matriz desta versão.");
    await activateTestVersion(q, id);
    await auditLog(q, actorId, "version.activate", "test_version", id);
  });
}
