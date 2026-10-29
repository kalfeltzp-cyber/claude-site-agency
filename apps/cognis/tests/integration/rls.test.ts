import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool, PoolClient } from "pg";
import { createUser, databaseAvailable, resetTestDatabase } from "../support/test-db";
import { finalizeAttempt, startAttempt } from "@/lib/services/assessment";
import { closePool } from "@/lib/db/pool";

/**
 * Executa as políticas RLS reais da migração com os papéis anon/authenticated,
 * simulando as claims JWT do Supabase.
 */
const available = await databaseAvailable();
const d = available ? describe : describe.skip;

let pool: Pool;
let u1: string;
let u2: string;
let attempt1: string;

async function as<T>(role: "anon" | "authenticated", sub: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role}`);
    if (sub) await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub, role })]);
    return await fn(c);
  } finally {
    await c.query("rollback");
    c.release();
  }
}

const denied = async (p: Promise<unknown>) => {
  try {
    await p;
    return false;
  } catch (e) {
    return /permission denied|violates row-level security/.test((e as Error).message);
  }
};

d("políticas RLS", () => {
  beforeAll(async () => {
    pool = await resetTestDatabase();
    u1 = await createUser(pool, "u1@example.test");
    u2 = await createUser(pool, "u2@example.test");
    attempt1 = (await startAttempt({ userId: u1, anonHash: null }, { consent: true })).attemptId;
    await finalizeAttempt(attempt1, { userId: u1, anonHash: null });
  });
  afterAll(async () => {
    await pool?.end();
    await closePool();
  });

  it("gabaritos e questões são inacessíveis a anon e authenticated", async () => {
    expect(await as("anon", null, (c) => denied(c.query("select answer_option_id from questions")))).toBe(true);
    expect(await as("authenticated", u1, (c) => denied(c.query("select * from questions")))).toBe(true);
    expect(await as("authenticated", u1, (c) => denied(c.query("select * from question_options")))).toBe(true);
    expect(await as("authenticated", u1, (c) => denied(c.query("select * from admin_audit_log")))).toBe(true);
  });

  it("conteúdo público é legível", async () => {
    const cats = await as("anon", null, (c) => c.query("select id from categories"));
    expect(cats.rows.length).toBe(10);
    const refs = await as("anon", null, (c) => c.query("select id from scientific_references"));
    expect(refs.rows.length).toBeGreaterThan(10);
  });

  it("cada usuário vê apenas os próprios dados", async () => {
    const own = await as("authenticated", u1, (c) => c.query("select id from attempts"));
    expect(own.rows.map((r) => r.id)).toEqual([attempt1]);
    const other = await as("authenticated", u2, (c) => c.query("select id from attempts"));
    expect(other.rows).toEqual([]);
    const res2 = await as("authenticated", u2, (c) => c.query("select * from results"));
    expect(res2.rows).toEqual([]);
    const items2 = await as("authenticated", u2, (c) => c.query("select * from attempt_items"));
    expect(items2.rows).toEqual([]);
    const hist1 = await as("authenticated", u1, (c) => c.query("select attempt_id from score_history"));
    expect(hist1.rows.map((r) => r.attempt_id)).toEqual([attempt1]);
    const hist2 = await as("authenticated", u2, (c) => c.query("select * from score_history"));
    expect(hist2.rows).toEqual([]);
    const anonAttempts = await as("anon", null, (c) => denied(c.query("select * from attempts")));
    // anon: sem política ⇒ zero linhas (RLS) ou permissão negada; nunca dados.
    if (!anonAttempts) {
      const rows = await as("anon", null, (c) => c.query("select * from attempts"));
      expect(rows.rows).toEqual([]);
    }
  });

  it("clientes não conseguem gravar ou alterar pontuações", async () => {
    expect(await as("authenticated", u1, (c) => denied(c.query("update results set performance_index = 100")))).toBe(true);
    expect(await as("authenticated", u1, (c) => denied(c.query("update attempts set status = 'completed'")))).toBe(true);
    expect(await as("authenticated", u1, (c) => denied(c.query("delete from results")))).toBe(true);
    expect(
      await as("authenticated", u1, (c) =>
        denied(c.query("insert into responses (attempt_id, question_id, selected_option_id) values ($1, 'num-001', 'a')", [attempt1])),
      ),
    ).toBe(true);
  });

  it("o titular altera o próprio nome, mas não o próprio papel nem o de terceiros", async () => {
    const ok = await as("authenticated", u1, async (c) => {
      await c.query("update profiles set display_name = 'Novo' where id = $1", [u1]);
      return (await c.query("select display_name from profiles where id = $1", [u1])).rows[0].display_name;
    });
    expect(ok).toBe("Novo");
    expect(await as("authenticated", u1, (c) => denied(c.query("update profiles set role = 'admin' where id = $1", [u1])))).toBe(true);
    const otherUpdated = await as("authenticated", u1, async (c) => (await c.query("update profiles set display_name = 'X' where id = $1", [u2])).rowCount);
    expect(otherUpdated).toBe(0);
  });
});
