import { Client, Pool } from "pg";
import { applyLocalAuthStub, migrate, seed } from "../../scripts/db-tasks";
import { closePool } from "@/lib/db/pool";

/**
 * Cria um banco Postgres descartável com o stub de auth, a migração real e o
 * conteúdo de data/. Requer TEST_DATABASE_URL (padrão: Postgres local).
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5432/cognis_test";

export async function databaseAvailable(): Promise<boolean> {
  const admin = new Client({ connectionString: TEST_DATABASE_URL.replace(/\/[^/]+$/, "/postgres") });
  try {
    await admin.connect();
    await admin.end();
    return true;
  } catch {
    return false;
  }
}

export async function resetTestDatabase(): Promise<Pool> {
  await closePool();
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(dbName)) throw new Error(`Recusando recriar banco que não termina em _test: ${dbName}`);
  const admin = new Client({ connectionString: TEST_DATABASE_URL.replace(/\/[^/]+$/, "/postgres") });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  await applyLocalAuthStub(pool);
  await migrate(pool, () => undefined);
  await seed(pool, {}, () => undefined);
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  return pool;
}

export async function createUser(pool: Pool, email: string): Promise<string> {
  const { rows } = await pool.query("insert into auth.users (email) values ($1) returning id", [email]);
  return rows[0].id;
}
