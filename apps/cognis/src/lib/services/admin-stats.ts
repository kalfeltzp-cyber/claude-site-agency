import { db, type Queryable } from "../db/pool";
import { histogram, mean, median, sd, MIN_PLATFORM_SAMPLE, type HistogramBin } from "../stats/descriptive";
import { analyzeItems, type ItemAnalysis } from "../stats/items";

/**
 * Métricas agregadas. Nenhuma função daqui devolve e-mail, nome ou
 * identificador de usuário: apenas contagens e estatísticas.
 */

export interface PlatformSummary {
  n: number;
  sufficient: boolean;
  mean: number | null;
  median: number | null;
  sd: number | null;
  distribution: HistogramBin[];
}

async function finishedIndices(q: Queryable, testVersionId?: string): Promise<number[]> {
  const rows = await q.query<{ performance_index: number }>(
    `select r.performance_index from public.results r
     join public.attempts a on a.id = r.attempt_id
     where a.status in ('completed', 'expired') ${testVersionId ? "and r.test_version_id = $1" : ""}`,
    testVersionId ? [testVersionId] : [],
  );
  return rows.map((r) => r.performance_index);
}

export async function platformSummary(testVersionId?: string, q: Queryable = db): Promise<PlatformSummary> {
  const xs = await finishedIndices(q, testVersionId);
  const sufficient = xs.length >= MIN_PLATFORM_SAMPLE;
  return {
    n: xs.length,
    sufficient,
    mean: sufficient ? mean(xs) : null,
    median: sufficient ? median(xs) : null,
    sd: sufficient ? sd(xs) : null,
    distribution: histogram(xs, 0, 100, 10),
  };
}

export interface Overview {
  users: number;
  started: number;
  finished: number;
  completed: number;
  expired: number;
  abandoned: number;
  inProgress: number;
  completionRate: number | null;
  meanTotalTimeMs: number | null;
  summary: PlatformSummary;
  byCategory: { category: string; name: string; responses: number; percentCorrect: number | null }[];
  byDifficulty: { difficulty: number; responses: number; percentCorrect: number | null }[];
}

export async function overview(q: Queryable = db): Promise<Overview> {
  const [users] = await q.query<{ n: number }>("select count(*)::int as n from public.profiles");
  const statusRows = await q.query<{ status: string; n: number }>(
    "select status, count(*)::int as n from public.attempts group by status",
  );
  const count = (s: string) => statusRows.find((r) => r.status === s)?.n ?? 0;
  const started = statusRows.reduce((s, r) => s + r.n, 0);
  const completed = count("completed");
  const expired = count("expired");
  const abandoned = count("abandoned");
  const finished = completed + expired;
  const closed = finished + abandoned;
  const [time] = await q.query<{ avg: number | null }>(
    `select avg(r.total_time_ms)::float8 as avg from public.results r
     join public.attempts a on a.id = r.attempt_id where a.status = 'completed'`,
  );
  const byCategory = await q.query<{ category: string; name: string; responses: number; correct: number }>(
    `select c.id as category, c.name, count(*)::int as responses,
            count(*) filter (where r.selected_option_id = qu.answer_option_id)::int as correct
     from public.attempt_items i
     join public.attempts a on a.id = i.attempt_id and a.status in ('completed', 'expired')
     join public.questions qu on qu.id = i.question_id
     join public.categories c on c.id = qu.category_id
     left join public.responses r on r.attempt_id = i.attempt_id and r.question_id = i.question_id
     group by c.id, c.name, c.sort_order order by c.sort_order`,
  );
  const byDifficulty = await q.query<{ difficulty: number; responses: number; correct: number }>(
    `select qu.difficulty, count(*)::int as responses,
            count(*) filter (where r.selected_option_id = qu.answer_option_id)::int as correct
     from public.attempt_items i
     join public.attempts a on a.id = i.attempt_id and a.status in ('completed', 'expired')
     join public.questions qu on qu.id = i.question_id
     left join public.responses r on r.attempt_id = i.attempt_id and r.question_id = i.question_id
     group by qu.difficulty order by qu.difficulty`,
  );
  const pct = (c: number, n: number) => (n ? Math.round((1000 * c) / n) / 10 : null);
  return {
    users: users.n,
    started,
    finished,
    completed,
    expired,
    abandoned,
    inProgress: count("in_progress"),
    // Taxa de conclusão sobre tentativas já encerradas (em andamento não entram).
    completionRate: closed ? Math.round((1000 * finished) / closed) / 10 : null,
    meanTotalTimeMs: time?.avg ?? null,
    summary: await platformSummary(undefined, q),
    byCategory: byCategory.map((c) => ({ category: c.category, name: c.name, responses: c.responses, percentCorrect: pct(c.correct, c.responses) })),
    byDifficulty: byDifficulty.map((d) => ({ difficulty: d.difficulty, responses: d.responses, percentCorrect: pct(d.correct, d.responses) })),
  };
}

export async function itemAnalysis(q: Queryable = db): Promise<ItemAnalysis[]> {
  const observations = await q.query<{ attempt_id: string; question_id: string; selected_option_id: string | null; is_correct: boolean | null }>(
    `select i.attempt_id, i.question_id, r.selected_option_id, (r.selected_option_id = qu.answer_option_id) as is_correct
     from public.attempt_items i
     join public.attempts a on a.id = i.attempt_id and a.status in ('completed', 'expired')
     join public.questions qu on qu.id = i.question_id
     left join public.responses r on r.attempt_id = i.attempt_id and r.question_id = i.question_id`,
  );
  const totals = await q.query<{ attempt_id: string; correct: number; total_items: number }>(
    `select r.attempt_id, r.correct, r.total_items from public.results r
     join public.attempts a on a.id = r.attempt_id and a.status in ('completed', 'expired')`,
  );
  const keys = await q.query<{ id: string; answer_option_id: string }>("select id, answer_option_id from public.questions");
  const analyzed = analyzeItems(
    observations.map((o) => ({
      attemptId: o.attempt_id,
      questionId: o.question_id,
      selectedOptionId: o.selected_option_id,
      isCorrect: o.selected_option_id === null ? null : Boolean(o.is_correct),
    })),
    totals.map((t) => ({ attemptId: t.attempt_id, correct: t.correct, total: t.total_items })),
    Object.fromEntries(keys.map((k) => [k.id, k.answer_option_id])),
  );
  // Itens nunca apresentados também aparecem, com n = 0.
  const seen = new Set(analyzed.map((a) => a.questionId));
  for (const k of keys) {
    if (!seen.has(k.id)) {
      analyzed.push({ questionId: k.id, n: 0, p: null, discrimination: null, omitRate: null, optionCounts: {}, flags: ["amostra_insuficiente"] });
    }
  }
  return analyzed.sort((a, b) => a.questionId.localeCompare(b.questionId));
}

/** Exportação agregada (sem dados pessoais) para análise externa. */
export async function aggregatedExport(q: Queryable = db) {
  const ov = await overview(q);
  const items = await itemAnalysis(q);
  return {
    generatedAt: new Date().toISOString(),
    notice:
      "Estatísticas agregadas da plataforma. Não contém dados pessoais. Os índices não são normas populacionais.",
    overview: { ...ov, summary: { ...ov.summary } },
    items,
  };
}

export function itemsToCsv(items: ItemAnalysis[]): string {
  const header = ["question_id", "n", "p", "discrimination", "omit_rate", "flags", "option_counts"];
  const lines = items.map((i) =>
    [
      i.questionId,
      i.n,
      i.p ?? "",
      i.discrimination ?? "",
      i.omitRate ?? "",
      i.flags.join("|"),
      Object.entries(i.optionCounts).map(([k, v]) => `${k}:${v}`).join("|"),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n") + "\n";
}
