import type { Queryable } from "../db/pool";
import {
  questionSchema,
  type Category,
  type Question,
  type ScientificReference,
  type TestVersion,
} from "../questions/schema";

/** Leitura e escrita do conteúdo (questões, categorias, versões, referências). */

interface QuestionRow {
  id: string;
  version: number;
  locale: string;
  category_id: string;
  difficulty: number;
  format: string;
  prompt: string;
  stimulus: unknown;
  figure: unknown;
  answer_option_id: string;
  explanation: string;
  rationale: string;
  recommended_seconds: number;
  status: string;
  active: boolean;
  tags: string[];
  quality: unknown;
  irt: unknown;
  options: { option_id: string; position: number; text: string | null; figure: unknown }[];
}

const QUESTION_SELECT = `
  select q.*, coalesce(
    (select json_agg(json_build_object('option_id', o.option_id, 'position', o.position, 'text', o.text, 'figure', o.figure)
            order by o.position)
     from public.question_options o where o.question_id = q.id), '[]'::json) as options
  from public.questions q`;

function rowToQuestion(r: QuestionRow): Question {
  return questionSchema.parse({
    id: r.id,
    version: r.version,
    locale: r.locale,
    category: r.category_id,
    difficulty: r.difficulty,
    format: r.format,
    prompt: r.prompt,
    stimulus: r.stimulus ?? undefined,
    figure: r.figure ?? undefined,
    options: r.options.map((o) => ({
      id: o.option_id,
      ...(o.text !== null ? { text: o.text } : {}),
      ...(o.figure !== null ? { figure: o.figure } : {}),
    })),
    answer: r.answer_option_id,
    explanation: r.explanation,
    rationale: r.rationale,
    recommendedSeconds: r.recommended_seconds,
    status: r.status,
    active: r.active,
    tags: r.tags,
    quality: r.quality,
    irt: r.irt ?? undefined,
  });
}

export async function getQuestionsByIds(q: Queryable, ids: string[]): Promise<Map<string, Question>> {
  if (!ids.length) return new Map();
  const rows = await q.query<QuestionRow>(`${QUESTION_SELECT} where q.id = any($1::text[])`, [ids]);
  return new Map(rows.map((r) => [r.id, rowToQuestion(r)]));
}

export async function listQuestions(q: Queryable): Promise<Question[]> {
  const rows = await q.query<QuestionRow>(`${QUESTION_SELECT} order by q.category_id, q.id`);
  return rows.map(rowToQuestion);
}

/** Questões elegíveis para sorteio: ativas, revisadas e de categoria ativa. */
export async function listSelectableQuestions(q: Queryable) {
  return q.query<{ id: string; category: string; difficulty: 1 | 2 | 3; option_ids: string[] }>(
    `select q.id, q.category_id as category, q.difficulty,
            array(select o.option_id from public.question_options o where o.question_id = q.id order by o.position) as option_ids
     from public.questions q join public.categories c on c.id = q.category_id
     where q.active and q.status = 'reviewed' and c.active`,
  );
}

export async function upsertQuestion(q: Queryable, question: Question, opts: { overwrite: boolean }): Promise<boolean> {
  const params = [
    question.id,
    question.version,
    question.locale,
    question.category,
    question.difficulty,
    question.format,
    question.prompt,
    question.stimulus ? JSON.stringify(question.stimulus) : null,
    question.figure ? JSON.stringify(question.figure) : null,
    question.answer,
    question.explanation,
    question.rationale,
    question.recommendedSeconds,
    question.status,
    question.active,
    question.tags,
    JSON.stringify(question.quality),
    question.irt ? JSON.stringify(question.irt) : null,
  ];
  const conflict = opts.overwrite
    ? `on conflict (id) do update set version = excluded.version, locale = excluded.locale,
        category_id = excluded.category_id, difficulty = excluded.difficulty, format = excluded.format,
        prompt = excluded.prompt, stimulus = excluded.stimulus, figure = excluded.figure,
        answer_option_id = excluded.answer_option_id, explanation = excluded.explanation,
        rationale = excluded.rationale, recommended_seconds = excluded.recommended_seconds,
        status = excluded.status, active = excluded.active, tags = excluded.tags,
        quality = excluded.quality, irt = excluded.irt`
    : "on conflict (id) do nothing";
  const rows = await q.query(
    `insert into public.questions (id, version, locale, category_id, difficulty, format, prompt, stimulus, figure,
       answer_option_id, explanation, rationale, recommended_seconds, status, active, tags, quality, irt)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ${conflict} returning id`,
    params,
  );
  if (!rows.length) return false;
  await q.query("delete from public.question_options where question_id = $1", [question.id]);
  for (const [position, o] of question.options.entries()) {
    await q.query(
      "insert into public.question_options (question_id, option_id, position, text, figure) values ($1,$2,$3,$4,$5)",
      [question.id, o.id, position, o.text ?? null, o.figure ? JSON.stringify(o.figure) : null],
    );
  }
  return true;
}

export async function setQuestionActive(q: Queryable, id: string, active: boolean): Promise<boolean> {
  const rows = await q.query("update public.questions set active = $2 where id = $1 returning id", [id, active]);
  return rows.length > 0;
}

export async function listCategories(q: Queryable, includeInactive = false): Promise<Category[]> {
  const rows = await q.query<{
    id: string;
    name: string;
    description: string;
    construct: string;
    practice: string[];
    sort_order: number;
    active: boolean;
  }>(`select * from public.categories ${includeInactive ? "" : "where active"} order by sort_order, id`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    construct: r.construct,
    practice: r.practice,
    sortOrder: r.sort_order,
    active: r.active,
  }));
}

export async function upsertCategory(q: Queryable, c: Category, opts: { overwrite: boolean }) {
  await q.query(
    `insert into public.categories (id, name, description, construct, practice, sort_order, active)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (id) do ${
       opts.overwrite
         ? `update set name = excluded.name, description = excluded.description, construct = excluded.construct,
            practice = excluded.practice, sort_order = excluded.sort_order, active = excluded.active`
         : "nothing"
     }`,
    [c.id, c.name, c.description, c.construct, JSON.stringify(c.practice), c.sortOrder, c.active],
  );
}

interface VersionRow {
  id: string;
  name: string;
  status: TestVersion["status"];
  time_limit_seconds: number;
  blueprint: TestVersion["blueprint"];
  notes: string;
  created_at: Date;
  activated_at: Date | null;
}

const rowToVersion = (r: VersionRow) => ({
  id: r.id,
  name: r.name,
  status: r.status,
  timeLimitSeconds: r.time_limit_seconds,
  blueprint: r.blueprint,
  notes: r.notes,
  createdAt: r.created_at.toISOString(),
  activatedAt: r.activated_at?.toISOString() ?? null,
});

export type StoredTestVersion = ReturnType<typeof rowToVersion>;

export async function listTestVersions(q: Queryable): Promise<StoredTestVersion[]> {
  const rows = await q.query<VersionRow>("select * from public.test_versions order by created_at, id");
  return rows.map(rowToVersion);
}

export async function getActiveTestVersion(q: Queryable): Promise<StoredTestVersion | null> {
  const rows = await q.query<VersionRow>("select * from public.test_versions where status = 'active' limit 1");
  return rows[0] ? rowToVersion(rows[0]) : null;
}

export async function insertTestVersion(q: Queryable, v: TestVersion, opts: { ignoreExisting: boolean }) {
  await q.query(
    `insert into public.test_versions (id, name, status, time_limit_seconds, blueprint, notes, activated_at)
     values ($1,$2,$3,$4,$5,$6, case when $3 = 'active' then now() end)
     ${opts.ignoreExisting ? "on conflict (id) do nothing" : ""}`,
    [v.id, v.name, v.status, v.timeLimitSeconds, JSON.stringify(v.blueprint), v.notes],
  );
}

/** Ativa uma versão e aposenta a anterior na mesma transação (tentativas antigas mantêm a versão). */
export async function activateTestVersion(q: Queryable, id: string) {
  const exists = await q.query("select 1 from public.test_versions where id = $1", [id]);
  if (!exists.length) return false;
  await q.query("update public.test_versions set status = 'retired' where status = 'active' and id <> $1", [id]);
  await q.query("update public.test_versions set status = 'active', activated_at = now() where id = $1", [id]);
  return true;
}

export async function upsertReference(q: Queryable, r: ScientificReference) {
  await q.query(
    `insert into public.scientific_references (id, authors, year, title, source, doi, url, topic, used_for)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (id) do update set authors = excluded.authors, year = excluded.year, title = excluded.title,
       source = excluded.source, doi = excluded.doi, url = excluded.url, topic = excluded.topic, used_for = excluded.used_for`,
    [r.id, r.authors, r.year, r.title, r.source, r.doi ?? null, r.url, r.topic, r.usedFor],
  );
}

export async function listReferences(q: Queryable): Promise<ScientificReference[]> {
  const rows = await q.query<{
    id: string;
    authors: string;
    year: number;
    title: string;
    source: string;
    doi: string | null;
    url: string;
    topic: string;
    used_for: string;
  }>("select * from public.scientific_references order by topic, year, id");
  return rows.map((r) => ({
    id: r.id,
    authors: r.authors,
    year: r.year,
    title: r.title,
    source: r.source,
    ...(r.doi ? { doi: r.doi } : {}),
    url: r.url,
    topic: r.topic,
    usedFor: r.used_for,
  }));
}

export async function auditLog(
  q: Queryable,
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await q.query(
    "insert into public.admin_audit_log (actor_id, action, entity, entity_id, details) values ($1,$2,$3,$4,$5)",
    [actorId, action, entity, entityId, JSON.stringify(details)],
  );
}
