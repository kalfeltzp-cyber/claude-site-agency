import fs from "node:fs";
import path from "node:path";
import { loadCategories, loadQuestions, loadReferences, loadTestVersions } from "../src/lib/questions/bank";

/**
 * Gera SQL puro com o conteúdo de data/ para quem prefere configurar o banco
 * pelo editor SQL do Supabase, sem terminal:
 *   supabase/seed.sql            — apenas o conteúdo (idempotente)
 *   supabase/setup-completo.sql  — migração + conteúdo, para colar de uma vez
 */

const ROOT = path.resolve(__dirname, "..");
const lit = (v: string | null | undefined) => (v === null || v === undefined ? "null" : `'${v.replace(/'/g, "''")}'`);
const json = (v: unknown) => (v === undefined || v === null ? "null" : `${lit(JSON.stringify(v))}::jsonb`);
const textArray = (xs: string[]) => (xs.length ? `array[${xs.map(lit).join(", ")}]::text[]` : "'{}'::text[]");

export function buildSeedSql(): string {
  const out: string[] = [
    "-- Conteúdo do Cognis (gerado por scripts/generate-sql.ts a partir de data/). Não edite à mão.",
    "-- Idempotente: não sobrescreve registros existentes.",
    "begin;",
  ];
  for (const c of loadCategories()) {
    out.push(
      `insert into public.categories (id, name, description, construct, practice, sort_order, active) values (${lit(c.id)}, ${lit(c.name)}, ${lit(c.description)}, ${lit(c.construct)}, ${json(c.practice)}, ${c.sortOrder}, ${c.active}) on conflict (id) do nothing;`,
    );
  }
  for (const q of loadQuestions()) {
    out.push(
      `insert into public.questions (id, version, locale, category_id, difficulty, format, prompt, stimulus, figure, answer_option_id, explanation, rationale, recommended_seconds, status, active, tags, quality, irt) values (${lit(q.id)}, ${q.version}, ${lit(q.locale)}, ${lit(q.category)}, ${q.difficulty}, ${lit(q.format)}, ${lit(q.prompt)}, ${json(q.stimulus)}, ${json(q.figure)}, ${lit(q.answer)}, ${lit(q.explanation)}, ${lit(q.rationale)}, ${q.recommendedSeconds}, ${lit(q.status)}, ${q.active}, ${textArray(q.tags)}, ${json(q.quality)}, ${json(q.irt)}) on conflict (id) do nothing;`,
    );
    q.options.forEach((o, position) => {
      out.push(
        `insert into public.question_options (question_id, option_id, position, text, figure) values (${lit(q.id)}, ${lit(o.id)}, ${position}, ${lit(o.text)}, ${json(o.figure)}) on conflict (question_id, option_id) do nothing;`,
      );
    });
  }
  for (const v of loadTestVersions()) {
    out.push(
      `insert into public.test_versions (id, name, status, time_limit_seconds, blueprint, notes, activated_at) values (${lit(v.id)}, ${lit(v.name)}, ${lit(v.status)}, ${v.timeLimitSeconds}, ${json(v.blueprint)}, ${lit(v.notes)}, ${v.status === "active" ? "now()" : "null"}) on conflict (id) do nothing;`,
    );
  }
  for (const r of loadReferences()) {
    out.push(
      `insert into public.scientific_references (id, authors, year, title, source, doi, url, topic, used_for) values (${lit(r.id)}, ${lit(r.authors)}, ${r.year}, ${lit(r.title)}, ${lit(r.source)}, ${lit(r.doi)}, ${lit(r.url)}, ${lit(r.topic)}, ${lit(r.usedFor)}) on conflict (id) do update set authors = excluded.authors, year = excluded.year, title = excluded.title, source = excluded.source, doi = excluded.doi, url = excluded.url, topic = excluded.topic, used_for = excluded.used_for;`,
    );
  }
  out.push("commit;", "");
  return out.join("\n");
}

export function buildSetupSql(seedSql: string): string {
  const dir = path.join(ROOT, "supabase/migrations");
  const migrations = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => `-- ===== migração: ${f}\n${fs.readFileSync(path.join(dir, f), "utf8")}`);
  return [
    "-- Cognis — configuração completa do banco para um projeto Supabase NOVO.",
    "-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run (uma única vez).",
    "-- Gerado por scripts/generate-sql.ts. Não edite à mão.",
    "",
    ...migrations,
    "-- ===== conteúdo",
    seedSql,
  ].join("\n");
}

if (require.main === module) {
  const seed = buildSeedSql();
  fs.writeFileSync(path.join(ROOT, "supabase/seed.sql"), seed);
  fs.writeFileSync(path.join(ROOT, "supabase/setup-completo.sql"), buildSetupSql(seed));
  console.log("gerados: supabase/seed.sql, supabase/setup-completo.sql");
}
