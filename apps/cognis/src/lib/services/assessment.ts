import { db, tx, type Queryable } from "../db/pool";
import type { Owner } from "../auth/owner";
import { randomToken, sha256Hex } from "../auth/crypto";
import { randomSeed } from "../engine/rng";
import { selectItems, BlueprintError } from "../engine/selection";
import { scoreAttempt, type ScoreResult } from "../engine/scoring";
import { estimateAbility } from "../engine/irt";
import type { Glyph, Question } from "../questions/schema";
import { AppError, conflict, notFound } from "../security/errors";
import { getActiveTestVersion, getQuestionsByIds, listCategories, listSelectableQuestions } from "./content-repo";

/**
 * Motor de avaliação do lado do servidor. A interface só recebe a visão
 * pública das questões (sem gabarito, sem explicação), as alternativas são
 * identificadas pela posição de exibição e a pontuação é calculada aqui.
 */

export type AttemptStatus = "in_progress" | "completed" | "expired" | "abandoned";

export interface PublicOption {
  index: number;
  label: string;
  text?: string;
  figure?: Glyph;
}

export interface PublicQuestion {
  id: string;
  category: string;
  categoryName: string;
  format: Question["format"];
  /** Nulo em itens de memória antes de o estímulo ser exibido. */
  prompt: string | null;
  figure: Question["figure"] | null;
  options: PublicOption[];
  recommendedSeconds: number;
  memory: { exposureSeconds: number; shown: boolean } | null;
}

export interface AttemptState {
  id: string;
  status: AttemptStatus;
  startedAt: string;
  deadlineAt: string;
  serverNow: string;
  timeLimitSeconds: number;
  items: {
    position: number;
    question: PublicQuestion;
    response: { optionIndex: number | null; timeSpentMs: number };
  }[];
}

interface AttemptRow {
  id: string;
  user_id: string | null;
  anon_session_hash: string | null;
  test_version_id: string;
  status: AttemptStatus;
  started_at: Date;
  deadline_at: Date;
  completed_at: Date | null;
  time_limit_seconds: number;
}

interface ItemRow {
  position: number;
  question_id: string;
  option_order: string[];
  stimulus_shown_at: Date | null;
  selected_option_id: string | null;
  time_spent_ms: number | null;
}

const LABELS = ["A", "B", "C", "D", "E", "F"];
/** Tolerância para latência de rede no fim do prazo. */
const DEADLINE_GRACE_MS = 5_000;
/** Teto de tempo atribuível a uma única questão (sessões esquecidas abertas). */
const MAX_ITEM_TIME_MS = 15 * 60_000;

function isOwner(a: Pick<AttemptRow, "user_id" | "anon_session_hash">, owner: Owner): boolean {
  if (a.user_id) return owner.userId === a.user_id;
  return Boolean(a.anon_session_hash && owner.anonHash && a.anon_session_hash === owner.anonHash);
}

async function loadAttempt(q: Queryable, attemptId: string, owner: Owner, lock = false): Promise<AttemptRow> {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) throw notFound("Avaliação");
  const rows = await q.query<AttemptRow>(
    `select a.*, v.time_limit_seconds from public.attempts a
     join public.test_versions v on v.id = a.test_version_id
     where a.id = $1 ${lock ? "for update of a" : ""}`,
    [attemptId],
  );
  const a = rows[0];
  if (!a) throw notFound("Avaliação");
  // Não revela a existência de tentativas de terceiros.
  if (!isOwner(a, owner)) throw notFound("Avaliação");
  return a;
}

async function loadItems(q: Queryable, attemptId: string): Promise<ItemRow[]> {
  return q.query<ItemRow>(
    `select i.position, i.question_id, i.option_order, i.stimulus_shown_at, r.selected_option_id, r.time_spent_ms
     from public.attempt_items i
     left join public.responses r on r.attempt_id = i.attempt_id and r.question_id = i.question_id
     where i.attempt_id = $1 order by i.position`,
    [attemptId],
  );
}

export function toPublicQuestion(
  question: Question,
  optionOrder: string[],
  categoryName: string,
  stimulusShown: boolean,
): PublicQuestion {
  const hideContent = question.format === "memory" && !stimulusShown;
  const byId = new Map(question.options.map((o) => [o.id, o]));
  return {
    id: question.id,
    category: question.category,
    categoryName,
    format: question.format,
    prompt: hideContent ? null : question.prompt,
    figure: question.figure ?? null,
    options: hideContent
      ? []
      : optionOrder.map((id, index) => {
          const o = byId.get(id)!;
          return { index, label: LABELS[index], ...(o.text ? { text: o.text } : {}), ...(o.figure ? { figure: o.figure } : {}) };
        }),
    recommendedSeconds: question.recommendedSeconds,
    memory: question.stimulus ? { exposureSeconds: question.stimulus.exposureSeconds, shown: stimulusShown } : null,
  };
}

/** Retorna a tentativa em andamento (não expirada) do dono, se existir. */
export async function findActiveAttempt(owner: Owner, q: Queryable = db): Promise<string | null> {
  if (!owner.userId && !owner.anonHash) return null;
  const rows = await q.query<{ id: string }>(
    `select id from public.attempts
     where status = 'in_progress' and deadline_at > now()
       and ((user_id is not null and user_id = $1) or (user_id is null and anon_session_hash = $2))
     order by started_at desc limit 1`,
    [owner.userId, owner.anonHash],
  );
  return rows[0]?.id ?? null;
}

export async function startAttempt(
  owner: Owner,
  opts: { consent: boolean; seed?: number },
): Promise<{ attemptId: string; resumed: boolean }> {
  if (!opts.consent) throw new AppError(422, "consent_required", "É necessário aceitar os termos para iniciar.");
  if (!owner.userId && !owner.anonHash) throw new AppError(400, "no_session", "Sessão não identificada.");

  return tx(async (q) => {
    // Serializa inícios concorrentes do mesmo dono (duplo clique, duas abas).
    await q.query("select pg_advisory_xact_lock(hashtext($1))", [owner.userId ?? owner.anonHash]);
    const existing = await findActiveAttempt(owner, q);
    if (existing) return { attemptId: existing, resumed: true };

    const version = await getActiveTestVersion(q);
    if (!version) throw new AppError(503, "no_active_version", "Nenhuma versão de avaliação está ativa no momento.");
    const bank = await listSelectableQuestions(q);
    const seed = opts.seed ?? randomSeed();
    let items;
    try {
      items = selectItems(
        bank.map((b) => ({ id: b.id, category: b.category, difficulty: b.difficulty, optionIds: b.option_ids })),
        version.blueprint,
        seed,
      );
    } catch (err) {
      if (err instanceof BlueprintError) {
        console.error("[assessment]", err.message);
        throw new AppError(503, "bank_insufficient", "O banco de questões ativo não atende à matriz da avaliação.");
      }
      throw err;
    }

    const rows = await q.query<{ id: string }>(
      `insert into public.attempts (user_id, anon_session_hash, test_version_id, seed, consented_at, deadline_at)
       values ($1, $2, $3, $4, now(), now() + make_interval(secs => $5)) returning id`,
      [owner.userId, owner.userId ? null : owner.anonHash, version.id, seed, version.timeLimitSeconds],
    );
    const attemptId = rows[0].id;
    await q.query(
      `insert into public.attempt_items (attempt_id, position, question_id, option_order)
       select $1, x.position, x.question_id, array(select json_array_elements_text(x.option_order))
       from json_to_recordset($2::json) as x(position int, question_id text, option_order json)`,
      [attemptId, JSON.stringify(items.map((i) => ({ position: i.position, question_id: i.questionId, option_order: i.optionOrder })))],
    );
    return { attemptId, resumed: false };
  });
}

export async function getAttemptState(attemptId: string, owner: Owner): Promise<AttemptState> {
  let attempt = await loadAttempt(db, attemptId, owner);
  if (attempt.status === "in_progress" && Date.now() > attempt.deadline_at.getTime() + DEADLINE_GRACE_MS) {
    await finalizeAttempt(attemptId, owner, "expired");
    attempt = await loadAttempt(db, attemptId, owner);
  }
  const items = await loadItems(db, attemptId);
  const questions = await getQuestionsByIds(db, items.map((i) => i.question_id));
  const categories = new Map((await listCategories(db, true)).map((c) => [c.id, c.name]));

  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.started_at.toISOString(),
    deadlineAt: attempt.deadline_at.toISOString(),
    serverNow: new Date().toISOString(),
    timeLimitSeconds: attempt.time_limit_seconds,
    items: items.map((i) => {
      const question = questions.get(i.question_id)!;
      const selectedIndex = i.selected_option_id ? i.option_order.indexOf(i.selected_option_id) : -1;
      return {
        position: i.position,
        question: toPublicQuestion(question, i.option_order, categories.get(question.category) ?? question.category, Boolean(i.stimulus_shown_at)),
        response: { optionIndex: selectedIndex >= 0 ? selectedIndex : null, timeSpentMs: i.time_spent_ms ?? 0 },
      };
    }),
  };
}

function assertWritable(a: AttemptRow) {
  if (a.status !== "in_progress") throw conflict("attempt_closed", "Esta avaliação já foi encerrada.");
  if (Date.now() > a.deadline_at.getTime() + DEADLINE_GRACE_MS) {
    throw conflict("attempt_expired", "O tempo da avaliação terminou.");
  }
}

/**
 * Registra (ou altera) a resposta de um item. Idempotente: reenviar a mesma
 * requisição não altera o resultado, e o tempo gasto nunca diminui.
 */
export async function saveResponse(
  attemptId: string,
  owner: Owner,
  input: { questionId: string; optionIndex: number | null; timeSpentMs: number },
): Promise<{ saved: true; optionIndex: number | null }> {
  try {
    return await tx(async (q) => {
      const attempt = await loadAttempt(q, attemptId, owner, true);
      assertWritable(attempt);
      const items = await q.query<{ option_order: string[]; stimulus_shown_at: Date | null; format: string }>(
        `select i.option_order, i.stimulus_shown_at, qu.format from public.attempt_items i
         join public.questions qu on qu.id = i.question_id
         where i.attempt_id = $1 and i.question_id = $2`,
        [attemptId, input.questionId],
      );
      const item = items[0];
      if (!item) throw notFound("Questão nesta avaliação");
      if (item.format === "memory" && !item.stimulus_shown_at) {
        throw conflict("stimulus_not_shown", "O estímulo de memória ainda não foi exibido.");
      }
      let optionId: string | null = null;
      if (input.optionIndex !== null) {
        if (!Number.isInteger(input.optionIndex) || input.optionIndex < 0 || input.optionIndex >= item.option_order.length) {
          throw new AppError(422, "invalid_option", "Alternativa inválida.");
        }
        optionId = item.option_order[input.optionIndex];
      }
      const elapsed = Date.now() - attempt.started_at.getTime();
      const time = Math.max(0, Math.min(Math.round(input.timeSpentMs), elapsed, MAX_ITEM_TIME_MS));
      await q.query(
        `insert into public.responses (attempt_id, question_id, selected_option_id, time_spent_ms, answered_at)
         values ($1, $2, $3, $4, case when $3::text is null then null else now() end)
         on conflict (attempt_id, question_id) do update set
           revision = public.responses.revision +
             case when public.responses.selected_option_id is distinct from excluded.selected_option_id then 1 else 0 end,
           answered_at = case when public.responses.selected_option_id is distinct from excluded.selected_option_id
                              then excluded.answered_at else public.responses.answered_at end,
           selected_option_id = excluded.selected_option_id,
           time_spent_ms = greatest(public.responses.time_spent_ms, excluded.time_spent_ms),
           updated_at = now()`,
        [attemptId, input.questionId, optionId, time],
      );
      await q.query("update public.attempts set last_activity_at = now() where id = $1", [attemptId]);
      return { saved: true as const, optionIndex: input.optionIndex };
    });
  } catch (err) {
    if (err instanceof AppError && err.code === "attempt_expired") {
      await finalizeAttempt(attemptId, owner, "expired").catch(() => undefined);
    }
    throw err;
  }
}

/** Exibe o estímulo de um item de memória UMA única vez (controle no servidor). */
export async function revealStimulus(
  attemptId: string,
  owner: Owner,
  questionId: string,
): Promise<{ stimulus: string; exposureSeconds: number; question: PublicQuestion }> {
  return tx(async (q) => {
    const attempt = await loadAttempt(q, attemptId, owner, true);
    assertWritable(attempt);
    const rows = await q.query<{ option_order: string[] }>(
      `update public.attempt_items set stimulus_shown_at = now()
       where attempt_id = $1 and question_id = $2 and stimulus_shown_at is null returning option_order`,
      [attemptId, questionId],
    );
    if (!rows[0]) {
      const exists = await q.query("select 1 from public.attempt_items where attempt_id = $1 and question_id = $2", [attemptId, questionId]);
      if (!exists.length) throw notFound("Questão nesta avaliação");
      throw conflict("stimulus_already_shown", "Este estímulo já foi exibido e não pode ser reapresentado.");
    }
    const question = (await getQuestionsByIds(q, [questionId])).get(questionId);
    if (!question?.stimulus) throw new AppError(422, "not_memory_item", "Esta questão não possui estímulo.");
    const cats = new Map((await listCategories(q, true)).map((c) => [c.id, c.name]));
    return {
      stimulus: question.stimulus.text,
      exposureSeconds: question.stimulus.exposureSeconds,
      question: toPublicQuestion(question, rows[0].option_order, cats.get(question.category) ?? question.category, true),
    };
  });
}

/**
 * Encerra e pontua a tentativa. Idempotente: chamadas repetidas devolvem o
 * mesmo resultado. Tentativas expiradas são pontuadas com o que foi respondido.
 */
export async function finalizeAttempt(
  attemptId: string,
  owner: Owner,
  reason: "completed" | "expired" = "completed",
): Promise<{ attemptId: string; status: AttemptStatus }> {
  return tx(async (q) => {
    const attempt = await loadAttempt(q, attemptId, owner, true);
    if (attempt.status === "completed" || attempt.status === "expired") {
      return { attemptId, status: attempt.status };
    }
    if (attempt.status === "abandoned") throw conflict("attempt_abandoned", "Esta avaliação foi abandonada.");

    const now = new Date();
    const pastDeadline = now.getTime() > attempt.deadline_at.getTime();
    const status: AttemptStatus = reason === "expired" || pastDeadline ? "expired" : "completed";
    const completedAt = pastDeadline ? attempt.deadline_at : now;

    const items = await loadItems(q, attemptId);
    const questions = await getQuestionsByIds(q, items.map((i) => i.question_id));
    const score = scoreAttempt({
      startedAt: attempt.started_at,
      completedAt,
      items: items.map((i) => {
        const question = questions.get(i.question_id)!;
        return {
          questionId: i.question_id,
          category: question.category,
          difficulty: question.difficulty,
          answer: question.answer,
          selectedOptionId: i.selected_option_id,
          timeSpentMs: i.time_spent_ms ?? 0,
        };
      }),
    });

    // Habilidade IRT só é estimada se TODOS os itens tiverem calibração real.
    const ability = estimateAbility(
      score.items
        .filter((o) => o.isCorrect !== null)
        .map((o) => {
          const irt = questions.get(o.questionId)!.irt;
          return { correct: o.isCorrect === true, params: { a: irt?.a ?? 1, b: irt?.b ?? 0, calibrated: Boolean(irt?.calibrated) } };
        }),
    );

    await q.query(
      `update public.responses r set is_correct = (r.selected_option_id = q.answer_option_id)
       from public.questions q
       where r.attempt_id = $1 and q.id = r.question_id and r.selected_option_id is not null`,
      [attemptId],
    );
    await q.query(
      `insert into public.results (attempt_id, user_id, test_version_id, scoring_version, total_items, correct,
         incorrect, unanswered, percent_correct, performance_index, total_time_ms, mean_time_ms,
         by_category, by_difficulty, ability_estimate, normed_score)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,null)`,
      [
        attemptId,
        attempt.user_id,
        attempt.test_version_id,
        score.scoringVersion,
        score.totalItems,
        score.correct,
        score.incorrect,
        score.unanswered,
        score.percentCorrect,
        score.performanceIndex,
        score.totalTimeMs,
        score.meanTimeMs,
        JSON.stringify(score.byCategory),
        JSON.stringify(score.byDifficulty),
        ability ? JSON.stringify(ability) : null,
      ],
    );
    await q.query(
      "update public.attempts set status = $2, completed_at = $3, last_activity_at = now() where id = $1",
      [attemptId, status, completedAt],
    );
    return { attemptId, status };
  });
}

export async function abandonAttempt(attemptId: string, owner: Owner): Promise<void> {
  await tx(async (q) => {
    const attempt = await loadAttempt(q, attemptId, owner, true);
    if (attempt.status !== "in_progress") throw conflict("attempt_closed", "Esta avaliação já foi encerrada.");
    await q.query("update public.attempts set status = 'abandoned', completed_at = now() where id = $1", [attemptId]);
  });
}

// ------------------------------------------------------------ resultados

export interface ItemReview {
  position: number;
  questionId: string;
  category: string;
  categoryName: string;
  difficulty: 1 | 2 | 3;
  format: Question["format"];
  prompt: string;
  stimulus: string | null;
  figure: Question["figure"] | null;
  options: { label: string; text?: string; figure?: Glyph; isAnswer: boolean; isSelected: boolean }[];
  isCorrect: boolean | null;
  timeSpentMs: number;
  explanation: string;
}

export interface ResultView {
  attemptId: string;
  status: AttemptStatus;
  testVersionId: string;
  startedAt: string;
  completedAt: string;
  score: Omit<ScoreResult, "items">;
  categoryNames: Record<string, string>;
  categoryPractice: Record<string, string[]>;
  abilityEstimate: unknown;
  normedScore: number | null;
  items: ItemReview[];
  isShared: boolean;
}

interface ResultRow {
  attempt_id: string;
  status: AttemptStatus;
  test_version_id: string;
  started_at: Date;
  completed_at: Date;
  scoring_version: string;
  total_items: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percent_correct: number;
  performance_index: number;
  total_time_ms: number;
  mean_time_ms: number;
  by_category: ScoreResult["byCategory"];
  by_difficulty: ScoreResult["byDifficulty"];
  ability_estimate: unknown;
  normed_score: number | null;
  share_token_hash: string | null;
}

async function buildResultView(row: ResultRow, includeItems: boolean): Promise<ResultView> {
  const categories = await listCategories(db, true);
  const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const categoryPractice = Object.fromEntries(categories.map((c) => [c.id, c.practice]));
  let items: ItemReview[] = [];
  if (includeItems) {
    const rows = await loadItems(db, row.attempt_id);
    const questions = await getQuestionsByIds(db, rows.map((r) => r.question_id));
    items = rows.map((r) => {
      const qn = questions.get(r.question_id)!;
      const byId = new Map(qn.options.map((o) => [o.id, o]));
      return {
        position: r.position,
        questionId: qn.id,
        category: qn.category,
        categoryName: categoryNames[qn.category] ?? qn.category,
        difficulty: qn.difficulty,
        format: qn.format,
        prompt: qn.prompt,
        stimulus: qn.stimulus?.text ?? null,
        figure: qn.figure ?? null,
        options: r.option_order.map((id, idx) => {
          const o = byId.get(id)!;
          return {
            label: LABELS[idx],
            ...(o.text ? { text: o.text } : {}),
            ...(o.figure ? { figure: o.figure } : {}),
            isAnswer: id === qn.answer,
            isSelected: id === r.selected_option_id,
          };
        }),
        isCorrect: r.selected_option_id === null ? null : r.selected_option_id === qn.answer,
        timeSpentMs: r.time_spent_ms ?? 0,
        explanation: qn.explanation,
      };
    });
  }
  return {
    attemptId: row.attempt_id,
    status: row.status,
    testVersionId: row.test_version_id,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at.toISOString(),
    score: {
      scoringVersion: row.scoring_version,
      totalItems: row.total_items,
      correct: row.correct,
      incorrect: row.incorrect,
      unanswered: row.unanswered,
      percentCorrect: row.percent_correct,
      performanceIndex: row.performance_index,
      totalTimeMs: row.total_time_ms,
      meanTimeMs: row.mean_time_ms,
      byCategory: row.by_category,
      byDifficulty: row.by_difficulty,
    },
    categoryNames,
    categoryPractice,
    abilityEstimate: row.ability_estimate,
    normedScore: row.normed_score,
    items,
    isShared: Boolean(row.share_token_hash),
  };
}

const RESULT_SELECT = `
  select r.*, a.status, a.started_at, a.completed_at, a.share_token_hash, a.user_id as owner_user_id,
         a.anon_session_hash
  from public.results r join public.attempts a on a.id = r.attempt_id`;

export async function getResult(attemptId: string, owner: Owner, opts: { includeItems?: boolean } = {}): Promise<ResultView> {
  await loadAttempt(db, attemptId, owner); // autorização
  const rows = await db.query<ResultRow>(`${RESULT_SELECT} where r.attempt_id = $1`, [attemptId]);
  if (!rows[0]) throw notFound("Resultado");
  return buildResultView(rows[0], opts.includeItems ?? false);
}

/** Cria (ou recria) um link de compartilhamento; o banco guarda só o hash do token. */
export async function createShareLink(attemptId: string, owner: Owner): Promise<{ token: string }> {
  const attempt = await loadAttempt(db, attemptId, owner);
  if (attempt.status !== "completed" && attempt.status !== "expired") {
    throw conflict("not_finished", "Só é possível compartilhar avaliações concluídas.");
  }
  const token = randomToken(24);
  await db.query("update public.attempts set share_token_hash = $2 where id = $1", [attemptId, sha256Hex(token)]);
  return { token };
}

export async function revokeShareLink(attemptId: string, owner: Owner): Promise<void> {
  await loadAttempt(db, attemptId, owner);
  await db.query("update public.attempts set share_token_hash = null where id = $1", [attemptId]);
}

/** Visão pública e anônima do resultado (sem itens, sem dados pessoais). */
export async function getSharedResult(token: string): Promise<ResultView | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const rows = await db.query<ResultRow>(`${RESULT_SELECT} where a.share_token_hash = $1`, [sha256Hex(token)]);
  if (!rows[0]) return null;
  return buildResultView(rows[0], false);
}

export interface HistoryEntry {
  attemptId: string;
  status: AttemptStatus;
  startedAt: string;
  completedAt: string | null;
  performanceIndex: number | null;
  correct: number | null;
  totalItems: number | null;
  totalTimeMs: number | null;
  testVersionId: string;
}

export async function listHistory(owner: Owner): Promise<HistoryEntry[]> {
  if (!owner.userId && !owner.anonHash) return [];
  const rows = await db.query<{
    id: string;
    status: AttemptStatus;
    started_at: Date;
    completed_at: Date | null;
    performance_index: number | null;
    correct: number | null;
    total_items: number | null;
    total_time_ms: number | null;
    test_version_id: string;
  }>(
    `select a.id, a.status, a.started_at, a.completed_at, a.test_version_id,
            r.performance_index, r.correct, r.total_items, r.total_time_ms
     from public.attempts a left join public.results r on r.attempt_id = a.id
     where (a.user_id is not null and a.user_id = $1) or (a.user_id is null and a.anon_session_hash = $2)
     order by a.started_at desc limit 200`,
    [owner.userId, owner.anonHash],
  );
  return rows.map((r) => ({
    attemptId: r.id,
    status: r.status,
    startedAt: r.started_at.toISOString(),
    completedAt: r.completed_at?.toISOString() ?? null,
    performanceIndex: r.performance_index,
    correct: r.correct,
    totalItems: r.total_items,
    totalTimeMs: r.total_time_ms,
    testVersionId: r.test_version_id,
  }));
}

/** Exportação dos dados do titular (portabilidade, LGPD art. 18, V). */
export async function exportOwnData(userId: string) {
  const owner: Owner = { userId, anonHash: null };
  const history = await listHistory(owner);
  const results = [];
  for (const h of history.filter((h) => h.status === "completed" || h.status === "expired")) {
    const r = await getResult(h.attemptId, owner, { includeItems: true });
    results.push({
      attemptId: r.attemptId,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      score: r.score,
      responses: r.items.map((i) => ({
        questionId: i.questionId,
        selected: i.options.find((o) => o.isSelected)?.label ?? null,
        isCorrect: i.isCorrect,
        timeSpentMs: i.timeSpentMs,
      })),
    });
  }
  return { history, results };
}

