import { Client, Pool } from "pg";
import { applyLocalAuthStub, migrate, seed } from "../../scripts/db-tasks";

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL || "postgres://postgres@127.0.0.1:5432/cognis_e2e";
  const dbName = new URL(url).pathname.slice(1);
  if (!/_e2e$/.test(dbName)) throw new Error(`Recusando recriar banco que não termina em _e2e: ${dbName}`);
  const admin = new Client({ connectionString: url.replace(/\/[^/]+$/, "/postgres") });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
  await admin.end();
  const pool = new Pool({ connectionString: url });
  await applyLocalAuthStub(pool);
  await migrate(pool, () => undefined);
  await seed(pool, {}, () => undefined);
  await pool.end();
}
