import { db, tx, type Queryable } from "../db/pool";
import { AppError } from "../security/errors";
import { hashPassword, hmacHex, randomToken, verifyPassword } from "./crypto";

export type Role = "user" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  createdAt: string;
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function loadProfile(userId: string, email: string, q: Queryable = db): Promise<SessionUser | null> {
  const rows = await q.query<{ id: string; display_name: string | null; role: Role; created_at: Date }>(
    "select id, display_name, role, created_at from public.profiles where id = $1",
    [userId],
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    email,
    displayName: rows[0].display_name,
    role: rows[0].role,
    createdAt: rows[0].created_at.toISOString(),
  };
}

/** Promove a admin quem estiver em ADMIN_EMAILS (configuração do servidor). */
export async function syncAdminRole(userId: string, email: string, adminEmails: string[], q: Queryable = db) {
  if (adminEmails.includes(email.toLowerCase())) {
    await q.query("update public.profiles set role = 'admin' where id = $1 and role <> 'admin'", [userId]);
  }
}

/** Vincula tentativas feitas sem conta (mesma sessão anônima) à conta recém-autenticada. */
export async function claimAnonymousAttempts(userId: string, anonHash: string | null, q: Queryable = db) {
  if (!anonHash) return 0;
  const rows = await q.query<{ id: string }>(
    `update public.attempts set user_id = $1, anon_session_hash = null
     where anon_session_hash = $2 and user_id is null returning id`,
    [userId, anonHash],
  );
  if (rows.length) {
    await q.query(
      `update public.results r set user_id = $1 from public.attempts a
       where a.id = r.attempt_id and a.id = any($2::uuid[])`,
      [userId, rows.map((r) => r.id)],
    );
  }
  return rows.length;
}

// ------------------------------------------------------------ modo local

export async function localSignUp(input: {
  email: string;
  password: string;
  displayName: string | null;
}): Promise<{ id: string; email: string }> {
  const email = input.email.trim().toLowerCase();
  const hash = await hashPassword(input.password);
  return tx(async (q) => {
    const existing = await q.query("select 1 from auth.users where email = $1", [email]);
    if (existing.length) throw new AppError(409, "email_taken", "Já existe uma conta com este e-mail.");
    const rows = await q.query<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [email, JSON.stringify({ display_name: input.displayName ?? "", privacy_accepted: true })],
    );
    await q.query("insert into local_auth.credentials (user_id, password_hash) values ($1, $2)", [rows[0].id, hash]);
    return { id: rows[0].id, email };
  });
}

// Hash fixo usado para equalizar o tempo de resposta quando o e-mail não existe.
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export async function localVerifyCredentials(email: string, password: string): Promise<{ id: string; email: string } | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await db.query<{ id: string; password_hash: string }>(
    `select u.id, c.password_hash from auth.users u
     join local_auth.credentials c on c.user_id = u.id where u.email = $1`,
    [normalized],
  );
  const ok = await verifyPassword(password, rows[0]?.password_hash ?? DUMMY_HASH);
  return ok && rows[0] ? { id: rows[0].id, email: normalized } : null;
}

export async function createLocalSession(userId: string, secret: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.query("insert into local_auth.sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
    hmacHex(secret, token),
    userId,
    expiresAt,
  ]);
  return { token, expiresAt };
}

export async function getLocalSessionUser(token: string, secret: string): Promise<SessionUser | null> {
  const rows = await db.query<{ id: string; email: string }>(
    `select u.id, u.email from local_auth.sessions s join auth.users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hmacHex(secret, token)],
  );
  if (!rows[0]) return null;
  return loadProfile(rows[0].id, rows[0].email);
}

export async function deleteLocalSession(token: string, secret: string) {
  await db.query("delete from local_auth.sessions where token_hash = $1", [hmacHex(secret, token)]);
}

/** Exclusão definitiva: o cascade remove perfil, tentativas, respostas e resultados. */
export async function deleteLocalUser(userId: string) {
  await db.query("delete from auth.users where id = $1", [userId]);
}

export async function updateDisplayName(userId: string, displayName: string | null) {
  await db.query("update public.profiles set display_name = $2 where id = $1", [userId, displayName]);
}
