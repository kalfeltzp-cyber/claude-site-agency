import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { Client, Pool } from "pg";
import { buildSeedSql, buildSetupSql } from "../../scripts/generate-sql";
import { applyLocalAuthStub, migrate, seed } from "../../scripts/db-tasks";
import { TEST_DATABASE_URL, databaseAvailable } from "../support/test-db";

/**
 * O arquivo supabase/setup-completo.sql (usado pelo editor SQL do Supabase)
 * deve estar atualizado e produzir exatamente o mesmo banco que migrate + seed.
 */
const available = await databaseAvailable();
const d = available ? describe : describe.skip;
const ROOT = path.resolve(__dirname, "../..");
const adminUrl = TEST_DATABASE_URL.replace(/\/[^/]+$/, "/postgres");
const urlFor = (name: string) => TEST_DATABASE_URL.replace(/\/[^/]+$/, `/${name}`);

async function recreate(name: string) {
  const c = new Client({ connectionString: adminUrl });
  await c.connect();
  await c.query(`drop database if exists ${name} with (force)`);
  await c.query(`create database ${name}`);
  await c.end();
}

const SNAPSHOT_QUERIES = [
  "select id, name, description, construct, practice, sort_order, active from categories order by id",
  "select id, version, category_id, difficulty, format, prompt, stimulus, figure, answer_option_id, explanation, rationale, recommended_seconds, status, active, tags, quality, irt from questions order by id",
  "select * from question_options order by question_id, position",
  "select id, name, status, time_limit_seconds, blueprint, notes from test_versions order by id",
  "select * from scientific_references order by id",
];

async function snapshot(pool: Pool) {
  const out = [];
  for (const q of SNAPSHOT_QUERIES) out.push((await pool.query(q)).rows);
  return out;
}

d("SQL de configuração para o Supabase", () => {
  const pools: Pool[] = [];
  afterAll(async () => {
    for (const p of pools) await p.end();
  });

  it("os arquivos gerados estão atualizados em relação a data/ e às migrações", () => {
    const seedSql = buildSeedSql();
    expect(fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8")).toBe(seedSql);
    expect(fs.readFileSync(path.join(ROOT, "supabase/setup-completo.sql"), "utf8")).toBe(buildSetupSql(seedSql));
  });

  it("setup-completo.sql produz o mesmo conteúdo que migrate + seed e é idempotente no conteúdo", async () => {
    await recreate("cognis_sqlfile_test");
    await recreate("cognis_sqlref_test");
    const viaFile = new Pool({ connectionString: urlFor("cognis_sqlfile_test") });
    const viaCode = new Pool({ connectionString: urlFor("cognis_sqlref_test") });
    pools.push(viaFile, viaCode);

    await applyLocalAuthStub(viaFile); // simula o schema auth que já existe no Supabase
    await viaFile.query(fs.readFileSync(path.join(ROOT, "supabase/setup-completo.sql"), "utf8"));
    await viaFile.query(fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8")); // reaplicar não duplica

    await applyLocalAuthStub(viaCode);
    await migrate(viaCode, () => undefined);
    await seed(viaCode, {}, () => undefined);

    const [a, b] = [await snapshot(viaFile), await snapshot(viaCode)];
    expect(a[1]).toHaveLength(77);
    expect(a).toEqual(b);
  });
});
