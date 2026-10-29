import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createUser, databaseAvailable, resetTestDatabase } from "../support/test-db";
import {
  abandonAttempt,
  createShareLink,
  findActiveAttempt,
  finalizeAttempt,
  getAttemptState,
  getResult,
  getSharedResult,
  listHistory,
  revealStimulus,
  saveResponse,
  startAttempt,
} from "@/lib/services/assessment";
import { claimAnonymousAttempts } from "@/lib/auth/users";
import { overview, itemAnalysis, platformSummary } from "@/lib/services/admin-stats";
import { closePool } from "@/lib/db/pool";
import { sha256Hex } from "@/lib/auth/crypto";
import type { Owner } from "@/lib/auth/owner";
import { AppError } from "@/lib/security/errors";

const available = await databaseAvailable();
const d = available ? describe : describe.skip;

let pool: Pool;
let userA: string;
let userB: string;
let ownerA: Owner;
let ownerB: Owner;
const anon: Owner = { userId: null, anonHash: sha256Hex("anon-cookie-1") };

async function answerKey(attemptId: string) {
  const { rows } = await pool.query(
    `select i.question_id, i.option_order, q.answer_option_id, q.format
     from attempt_items i join questions q on q.id = i.question_id where i.attempt_id = $1 order by i.position`,
    [attemptId],
  );
  return rows as { question_id: string; option_order: string[]; answer_option_id: string; format: string }[];
}

/** Abandona a tentativa em andamento (se houver) e inicia uma nova. */
async function fresh(owner: Owner) {
  const current = await findActiveAttempt(owner);
  if (current) await abandonAttempt(current, owner);
  return startAttempt(owner, { consent: true });
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof AppError ? e.code : (e as Error).message;
  }
};

d("motor de avaliação (Postgres real)", () => {
  beforeAll(async () => {
    pool = await resetTestDatabase();
    userA = await createUser(pool, "a@example.test");
    userB = await createUser(pool, "b@example.test");
    ownerA = { userId: userA, anonHash: null };
    ownerB = { userId: userB, anonHash: null };
  });
  afterAll(async () => {
    await pool?.end();
    await closePool();
  });

  it("exige consentimento", async () => {
    expect(await code(startAttempt(ownerA, { consent: false }))).toBe("consent_required");
  });

  it("cria tentativa com 36 itens e não expõe gabarito nem estímulo", async () => {
    const { attemptId, resumed } = await startAttempt(ownerA, { consent: true, seed: 777 });
    expect(resumed).toBe(false);
    const state = await getAttemptState(attemptId, ownerA);
    expect(state.items).toHaveLength(36);
    const serialized = JSON.stringify(state);
    expect(serialized).not.toMatch(/"answer"|explanation|answer_option_id|isAnswer/);
    for (const it of state.items) {
      if (it.question.format === "memory") {
        expect(it.question.prompt).toBeNull();
        expect(it.question.options).toEqual([]);
        expect(serialized).not.toContain("exposureSeconds\":0");
      }
      for (const o of it.question.options) expect(Object.keys(o).sort()).toEqual(expect.arrayContaining(["index", "label"]));
    }
    // Estímulos não aparecem no estado público.
    const { rows } = await pool.query("select stimulus->>'text' as t from questions where stimulus is not null");
    for (const r of rows) expect(serialized).not.toContain(r.t);
  });

  it("retoma a tentativa em andamento em vez de criar outra", async () => {
    const first = await startAttempt(ownerA, { consent: true });
    const second = await startAttempt(ownerA, { consent: true });
    expect(second).toEqual({ attemptId: first.attemptId, resumed: true });
    const { rows } = await pool.query("select count(*)::int as n from attempts where user_id = $1", [userA]);
    expect(rows[0].n).toBe(1);
  });

  it("inícios concorrentes não criam tentativas duplicadas", async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => startAttempt(ownerB, { consent: true })));
    expect(new Set(results.map((r) => r.attemptId)).size).toBe(1);
    await abandonAttempt(results[0].attemptId, ownerB);
  });

  it("isola tentativas entre usuários", async () => {
    const { attemptId } = await fresh(ownerA);
    expect(await code(getAttemptState(attemptId, ownerB))).toBe("not_found");
    expect(await code(getAttemptState(attemptId, anon))).toBe("not_found");
    const key = await answerKey(attemptId);
    expect(await code(saveResponse(attemptId, ownerB, { questionId: key[0].question_id, optionIndex: 0, timeSpentMs: 10 }))).toBe("not_found");
    expect(await code(finalizeAttempt(attemptId, ownerB))).toBe("not_found");
    expect(await code(getAttemptState("not-a-uuid", ownerA))).toBe("not_found");
  });

  it("valida respostas, é idempotente e nunca reduz o tempo", async () => {
    const { attemptId } = await fresh(ownerA);
    const key = await answerKey(attemptId);
    const first = key.find((k) => k.format !== "memory")!;
    expect(await code(saveResponse(attemptId, ownerA, { questionId: first.question_id, optionIndex: 9, timeSpentMs: 1 }))).toBe("invalid_option");
    expect(await code(saveResponse(attemptId, ownerA, { questionId: "xyz-999", optionIndex: 0, timeSpentMs: 1 }))).toBe("not_found");

    await saveResponse(attemptId, ownerA, { questionId: first.question_id, optionIndex: 1, timeSpentMs: 500 });
    await saveResponse(attemptId, ownerA, { questionId: first.question_id, optionIndex: 1, timeSpentMs: 500 });
    await saveResponse(attemptId, ownerA, { questionId: first.question_id, optionIndex: 1, timeSpentMs: 200 });
    const { rows } = await pool.query("select * from responses where attempt_id = $1", [attemptId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].revision).toBe(1);
    expect(rows[0].time_spent_ms).toBeLessThanOrEqual(500);
    expect(rows[0].selected_option_id).toBe(first.option_order[1]);
    expect(rows[0].is_correct).toBeNull(); // correção só no encerramento

    await saveResponse(attemptId, ownerA, { questionId: first.question_id, optionIndex: 2, timeSpentMs: 900 });
    const after = (await pool.query("select * from responses where attempt_id = $1", [attemptId])).rows[0];
    expect(after.revision).toBe(2);
    expect(after.selected_option_id).toBe(first.option_order[2]);

    const state = await getAttemptState(attemptId, ownerA);
    const restored = state.items.find((i) => i.question.id === first.question_id)!;
    expect(restored.response.optionIndex).toBe(2);
  });

  it("exibe estímulo de memória uma única vez e só então aceita resposta", async () => {
    const { attemptId } = await fresh(ownerA);
    const mem = (await answerKey(attemptId)).find((k) => k.format === "memory")!;
    expect(await code(saveResponse(attemptId, ownerA, { questionId: mem.question_id, optionIndex: 0, timeSpentMs: 10 }))).toBe("stimulus_not_shown");
    const revealed = await revealStimulus(attemptId, ownerA, mem.question_id);
    expect(revealed.stimulus.length).toBeGreaterThan(0);
    expect(revealed.question.prompt).not.toBeNull();
    expect(revealed.question.options.length).toBeGreaterThanOrEqual(4);
    expect(await code(revealStimulus(attemptId, ownerA, mem.question_id))).toBe("stimulus_already_shown");
    expect(await code(saveResponse(attemptId, ownerA, { questionId: mem.question_id, optionIndex: 0, timeSpentMs: 10 }))).toBe("ok");
    const state = await getAttemptState(attemptId, ownerA);
    const item = state.items.find((i) => i.question.id === mem.question_id)!;
    expect(item.question.memory).toEqual({ exposureSeconds: expect.any(Number), shown: true });
    expect(item.question.prompt).not.toBeNull();
  });

  it("pontua no servidor com o gabarito correto e é idempotente", async () => {
    const { attemptId } = await fresh(ownerA);
    const key = await answerKey(attemptId);
    let expectedCorrect = 0;
    // Responde corretamente os itens de índice par (exceto memória), erra os ímpares, deixa memória em branco.
    for (const [i, k] of key.entries()) {
      if (k.format === "memory") continue;
      const correctIdx = k.option_order.indexOf(k.answer_option_id);
      const idx = i % 2 === 0 ? correctIdx : (correctIdx + 1) % k.option_order.length;
      if (i % 2 === 0) expectedCorrect++;
      await saveResponse(attemptId, ownerA, { questionId: k.question_id, optionIndex: idx, timeSpentMs: 1000 });
    }
    const memCount = key.filter((k) => k.format === "memory").length;
    const r1 = await finalizeAttempt(attemptId, ownerA);
    const r2 = await finalizeAttempt(attemptId, ownerA);
    expect(r1).toEqual(r2);
    expect(r1.status).toBe("completed");
    const result = await getResult(attemptId, ownerA, { includeItems: true });
    expect(result.score.correct).toBe(expectedCorrect);
    expect(result.score.unanswered).toBe(memCount);
    expect(result.score.incorrect).toBe(36 - expectedCorrect - memCount);
    expect(result.score.performanceIndex).toBeCloseTo(Math.round((1000 * expectedCorrect) / 36) / 10, 5);
    expect(result.score.byCategory.reduce((s, c) => s + c.total, 0)).toBe(36);
    expect(result.items.filter((i) => i.isCorrect === true)).toHaveLength(expectedCorrect);
    expect(result.normedScore).toBeNull();
    expect(result.abilityEstimate).toBeNull();
    const { rows } = await pool.query("select count(*)::int as n from results where attempt_id = $1", [attemptId]);
    expect(rows[0].n).toBe(1);
    // Respostas após o encerramento são rejeitadas.
    expect(await code(saveResponse(attemptId, ownerA, { questionId: key[0].question_id, optionIndex: 0, timeSpentMs: 1 }))).toBe("attempt_closed");
  });

  it("encerra automaticamente tentativas cujo prazo expirou", async () => {
    const { attemptId } = await fresh(ownerA);
    const key = await answerKey(attemptId);
    const k = key.find((x) => x.format !== "memory")!;
    await saveResponse(attemptId, ownerA, { questionId: k.question_id, optionIndex: k.option_order.indexOf(k.answer_option_id), timeSpentMs: 1000 });
    await pool.query("update attempts set started_at = now() - interval '2 hours', deadline_at = now() - interval '1 hour' where id = $1", [attemptId]);
    expect(await code(saveResponse(attemptId, ownerA, { questionId: k.question_id, optionIndex: 0, timeSpentMs: 1 }))).toBe("attempt_expired");
    const state = await getAttemptState(attemptId, ownerA);
    expect(state.status).toBe("expired");
    const result = await getResult(attemptId, ownerA);
    expect(result.score.correct).toBe(1);
    expect(result.score.unanswered).toBe(35);
    expect(result.score.totalTimeMs).toBe(60 * 60 * 1000);
  });

  it("abandono impede pontuação e libera nova tentativa", async () => {
    const { attemptId } = await fresh(ownerA);
    await abandonAttempt(attemptId, ownerA);
    expect(await code(finalizeAttempt(attemptId, ownerA))).toBe("attempt_abandoned");
    const next = await startAttempt(ownerA, { consent: true });
    expect(next.attemptId).not.toBe(attemptId);
    await abandonAttempt(next.attemptId, ownerA);
  });

  it("compartilhamento usa token secreto e não expõe itens", async () => {
    const hist = await listHistory(ownerA);
    const done = hist.find((h) => h.status === "completed")!;
    const { token } = await createShareLink(done.attemptId, ownerA);
    expect(await code(createShareLink(done.attemptId, ownerB))).toBe("not_found");
    const shared = await getSharedResult(token);
    expect(shared?.attemptId).toBe(done.attemptId);
    expect(shared?.items).toEqual([]);
    expect(await getSharedResult("x".repeat(32))).toBeNull();
    const { rows } = await pool.query("select share_token_hash from attempts where id = $1", [done.attemptId]);
    expect(rows[0].share_token_hash).toBe(sha256Hex(token));
  });

  it("tentativas anônimas são vinculadas à conta no login", async () => {
    const { attemptId } = await fresh(anon);
    await finalizeAttempt(attemptId, anon);
    const claimed = await claimAnonymousAttempts(userB, anon.anonHash);
    expect(claimed).toBe(1);
    expect(await code(getResult(attemptId, anon))).toBe("not_found");
    const r = await getResult(attemptId, ownerB);
    expect(r.attemptId).toBe(attemptId);
    const { rows } = await pool.query("select user_id from results where attempt_id = $1", [attemptId]);
    expect(rows[0].user_id).toBe(userB);
  });

  it("histórico lista apenas as tentativas do dono", async () => {
    const a = await listHistory(ownerA);
    const b = await listHistory(ownerB);
    const idsA = new Set(a.map((h) => h.attemptId));
    expect(b.some((h) => idsA.has(h.attemptId))).toBe(false);
    expect(a.every((h) => ["completed", "expired", "abandoned", "in_progress"].includes(h.status))).toBe(true);
  });

  it("estatísticas agregadas são coerentes e sem dados pessoais", async () => {
    const ov = await overview();
    expect(ov.users).toBe(2);
    expect(ov.started).toBe(ov.completed + ov.expired + ov.abandoned + ov.inProgress);
    expect(ov.summary.n).toBe(ov.completed + ov.expired);
    expect(ov.summary.sufficient).toBe(false);
    expect(ov.summary.mean).toBeNull();
    expect(JSON.stringify(ov)).not.toMatch(/@example\.test/);
    const items = await itemAnalysis();
    expect(items.length).toBe(77);
    expect(items.every((i) => i.flags.includes("amostra_insuficiente"))).toBe(true);
    const ps = await platformSummary();
    expect(ps.distribution.reduce((s, b) => s + b.count, 0)).toBe(ps.n);
  });

  it("exclusão da conta remove em cascata todos os dados do titular", async () => {
    await pool.query("delete from auth.users where id = $1", [userA]);
    for (const t of ["profiles where id", "attempts where user_id", "results where user_id"]) {
      const { rows } = await pool.query(`select count(*)::int as n from ${t} = $1`, [userA]);
      expect(rows[0].n, t).toBe(0);
    }
    const orphan = await pool.query("select count(*)::int as n from responses r left join attempts a on a.id = r.attempt_id where a.id is null");
    expect(orphan.rows[0].n).toBe(0);
  });
});
