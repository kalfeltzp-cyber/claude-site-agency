import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Acesso ao Postgres (Supabase em produção, Postgres local em desenvolvimento).
 * O servidor conecta com um papel que ignora RLS e, por isso, TODA função de
 * repositório recebe o dono (usuário/sessão anônima) e filtra explicitamente.
 */

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
}

function sslOption(url: string) {
  const mode = process.env.DATABASE_SSL;
  if (mode === "disable") return false;
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url);
  if (!mode && isLocal) return false;
  if (process.env.DATABASE_SSL_CA) return { ca: process.env.DATABASE_SSL_CA, rejectUnauthorized: true };
  // Supabase exige TLS; sem CA explícita, a conexão é cifrada mas o certificado não é fixado.
  return { rejectUnauthorized: false };
}

const globalForPool = globalThis as unknown as { __cognisPool?: Pool; __cognisPoolUrl?: string };

export function getPool(url = process.env.DATABASE_URL): Pool {
  if (!url) throw new Error("DATABASE_URL não configurada.");
  if (globalForPool.__cognisPool && globalForPool.__cognisPoolUrl === url) return globalForPool.__cognisPool;
  const pool = new Pool({
    connectionString: url,
    ssl: sslOption(url),
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (err) => console.error("[db] erro em conexão ociosa:", err.message));
  globalForPool.__cognisPool = pool;
  globalForPool.__cognisPoolUrl = url;
  return pool;
}

export const db: Queryable = {
  async query(text, params) {
    const res = await getPool().query(text, params as unknown[]);
    return res.rows;
  },
};

export async function tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query("begin");
    const q: Queryable = {
      async query(text, params) {
        return (await client.query(text, params as unknown[])).rows;
      },
    };
    const out = await fn(q);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (globalForPool.__cognisPool) {
    await globalForPool.__cognisPool.end();
    globalForPool.__cognisPool = undefined;
    globalForPool.__cognisPoolUrl = undefined;
  }
}
