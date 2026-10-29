import { Pool } from "pg";
import { migrate } from "./db-tasks";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL.");
  const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  try {
    await migrate(pool);
    console.log("migrações em dia.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
