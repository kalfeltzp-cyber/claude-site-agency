import { Pool } from "pg";
import { stripSslParams } from "../src/lib/db/pool";
import { seed } from "./db-tasks";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL.");
  const pool = new Pool({ connectionString: stripSslParams(url), ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  try {
    await seed(pool, { overwrite: process.argv.includes("--overwrite") });
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
