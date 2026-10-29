import fs from "node:fs";
import path from "node:path";
import type { Pool } from "pg";
import { loadCategories, loadQuestions, loadReferences, loadTestVersions } from "../src/lib/questions/bank";
import { blueprintShortfalls } from "../src/lib/engine/selection";
import {
  insertTestVersion,
  upsertCategory,
  upsertQuestion,
  upsertReference,
} from "../src/lib/services/content-repo";
import type { Queryable } from "../src/lib/db/pool";

const ROOT = path.resolve(__dirname, "..");

function wrap(pool: Pool): Queryable {
  return { query: async (text, params) => (await pool.query(text, params as unknown[])).rows };
}

/** Aplica o stub de autenticação local (somente fora do Supabase). */
export async function applyLocalAuthStub(pool: Pool) {
  await pool.query(fs.readFileSync(path.join(ROOT, "db/local/auth-stub.sql"), "utf8"));
}

/** Aplica migrações pendentes de supabase/migrations, cada uma em uma transação. */
export async function migrate(pool: Pool, log = console.log) {
  await pool.query(`create schema if not exists cognis_meta;
    create table if not exists cognis_meta.migrations (version text primary key, applied_at timestamptz not null default now())`);
  const dir = path.join(ROOT, "supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set((await pool.query("select version from cognis_meta.migrations")).rows.map((r) => r.version));
  for (const file of files) {
    if (applied.has(file)) continue;
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
      await client.query("insert into cognis_meta.migrations (version) values ($1)", [file]);
      await client.query("commit");
      log(`migração aplicada: ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`falha na migração ${file}: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
}

/**
 * Popula conteúdo a partir de data/. Por padrão NÃO sobrescreve questões e
 * categorias existentes (edições feitas no painel são preservadas).
 */
export async function seed(pool: Pool, opts: { overwrite?: boolean } = {}, log = console.log) {
  const categories = loadCategories();
  const questions = loadQuestions();
  const versions = loadTestVersions();
  const references = loadReferences();

  for (const v of versions) {
    const short = blueprintShortfalls(
      questions.filter((q) => q.active && q.status === "reviewed").map((q) => ({ id: q.id, category: q.category, difficulty: q.difficulty, optionIds: q.options.map((o) => o.id) })),
      v.blueprint,
    );
    if (short.length) throw new Error(`versão ${v.id}: banco insuficiente ${JSON.stringify(short)}`);
  }

  const client = await pool.connect();
  const q: Queryable = { query: async (t, p) => (await client.query(t, p as unknown[])).rows };
  try {
    await client.query("begin");
    for (const c of categories) await upsertCategory(q, c, { overwrite: Boolean(opts.overwrite) });
    let inserted = 0;
    for (const qu of questions) if (await upsertQuestion(q, qu, { overwrite: Boolean(opts.overwrite) })) inserted++;
    for (const v of versions) await insertTestVersion(q, v, { ignoreExisting: true });
    for (const r of references) await upsertReference(q, r);
    await client.query("commit");
    log(`seed: ${categories.length} categorias, ${inserted}/${questions.length} questões gravadas, ${versions.length} versão(ões), ${references.length} referências`);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export { wrap };
