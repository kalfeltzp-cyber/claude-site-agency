import { Pool } from "pg";
import { applyLocalAuthStub, migrate, seed } from "./db-tasks";

/**
 * Prepara um Postgres LOCAL para desenvolvimento sem Supabase:
 * stub de auth + migrações + conteúdo. Recusa URLs que pareçam Supabase.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL (ex.: postgres://postgres:postgres@localhost:5432/cognis).");
  if (/supabase\.(co|com)/.test(url)) throw new Error("setup-local não deve ser usado em um projeto Supabase. Use db:migrate.");
  const pool = new Pool({ connectionString: url });
  try {
    await applyLocalAuthStub(pool);
    await migrate(pool);
    await seed(pool);
    console.log("banco local pronto.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
