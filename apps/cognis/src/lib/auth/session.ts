import "server-only";
export type { Owner } from "./owner";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "../config";
import { AppError, forbidden, unauthorized } from "../security/errors";
import { randomToken, sha256Hex } from "./crypto";
import type { Owner } from "./owner";
import {
  claimAnonymousAttempts,
  createLocalSession,
  deleteLocalSession,
  deleteLocalUser,
  getLocalSessionUser,
  loadProfile,
  localSignUp,
  localVerifyCredentials,
  SESSION_TTL_MS,
  syncAdminRole,
  type SessionUser,
} from "./users";

export const SESSION_COOKIE = "cognis_session";
export const ANON_COOKIE = "cognis_anon";
const ANON_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cookieBase() {
  return { httpOnly: true, sameSite: "lax" as const, secure: getConfig().isProduction, path: "/" };
}

export async function supabaseServer() {
  const cfg = getConfig();
  const store = await cookies();
  return createServerClient(cfg.supabaseUrl!, cfg.supabaseAnonKey!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Chamado a partir de Server Component: o middleware renova a sessão.
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cfg = getConfig();
  try {
    if (cfg.authMode === "supabase") {
      const supabase = await supabaseServer();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      return loadProfile(data.user.id, data.user.email ?? "");
    }
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token || !cfg.sessionSecret) return null;
    return await getLocalSessionUser(token, cfg.sessionSecret);
  } catch (err) {
    console.error("[auth] falha ao obter sessão:", (err as Error).message);
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** Autorização administrativa verificada no servidor a partir do banco. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw forbidden();
  return user;
}


/**
 * Identifica o dono de uma tentativa: usuário autenticado ou sessão anônima
 * (cookie httpOnly aleatório; o banco guarda apenas o SHA-256).
 */
export async function getOwner(opts: { createAnon?: boolean } = {}): Promise<Owner> {
  const user = await getCurrentUser();
  const store = await cookies();
  let anon = store.get(ANON_COOKIE)?.value ?? null;
  if (!user && !anon && opts.createAnon) {
    anon = randomToken();
    store.set(ANON_COOKIE, anon, { ...cookieBase(), maxAge: ANON_TTL_MS / 1000 });
  }
  return { userId: user?.id ?? null, anonHash: anon ? sha256Hex(anon) : null };
}

async function anonHashFromCookie(): Promise<string | null> {
  const anon = (await cookies()).get(ANON_COOKIE)?.value;
  return anon ? sha256Hex(anon) : null;
}

async function afterLogin(userId: string, email: string) {
  const cfg = getConfig();
  await syncAdminRole(userId, email, cfg.adminEmails);
  await claimAnonymousAttempts(userId, await anonHashFromCookie());
}

export async function signUp(input: {
  email: string;
  password: string;
  displayName: string | null;
}): Promise<{ status: "signed_in" | "confirmation_required" }> {
  const cfg = getConfig();
  if (cfg.authMode === "supabase") {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { display_name: input.displayName ?? "", privacy_accepted: true },
        emailRedirectTo: `${cfg.siteUrl}/auth/confirm`,
      },
    });
    if (error) throw new AppError(400, "signup_failed", traduzErroSupabase(error.message));
    if (!data.session || !data.user) return { status: "confirmation_required" };
    await afterLogin(data.user.id, data.user.email ?? input.email);
    return { status: "signed_in" };
  }
  const user = await localSignUp(input);
  await startLocalSession(user.id);
  await afterLogin(user.id, user.email);
  return { status: "signed_in" };
}

export async function signIn(email: string, password: string): Promise<void> {
  const cfg = getConfig();
  if (cfg.authMode === "supabase") {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new AppError(401, "invalid_credentials", "E-mail ou senha incorretos.");
    await afterLogin(data.user.id, data.user.email ?? email);
    return;
  }
  const user = await localVerifyCredentials(email, password);
  if (!user) throw new AppError(401, "invalid_credentials", "E-mail ou senha incorretos.");
  await startLocalSession(user.id);
  await afterLogin(user.id, user.email);
}

async function startLocalSession(userId: string) {
  const cfg = getConfig();
  const { token } = await createLocalSession(userId, cfg.sessionSecret!);
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase(), maxAge: SESSION_TTL_MS / 1000 });
}

export async function signOut(): Promise<void> {
  const cfg = getConfig();
  const store = await cookies();
  if (cfg.authMode === "supabase") {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  } else {
    const token = store.get(SESSION_COOKIE)?.value;
    if (token && cfg.sessionSecret) await deleteLocalSession(token, cfg.sessionSecret);
    store.delete(SESSION_COOKIE);
  }
}

/** Exclui a conta e, em cascata, todos os dados pessoais e resultados (LGPD, art. 18). */
export async function deleteAccount(userId: string): Promise<void> {
  const cfg = getConfig();
  if (cfg.authMode === "supabase") {
    if (!cfg.supabaseServiceRoleKey) {
      throw new AppError(503, "not_configured", "Exclusão indisponível: SUPABASE_SERVICE_ROLE_KEY não configurada.");
    }
    const admin = createClient(cfg.supabaseUrl!, cfg.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new AppError(500, "delete_failed", "Não foi possível excluir a conta. Tente novamente.");
    await signOut().catch(() => undefined);
  } else {
    await deleteLocalUser(userId);
    (await cookies()).delete(SESSION_COOKIE);
  }
  (await cookies()).delete(ANON_COOKIE);
}

function traduzErroSupabase(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered")) return "Já existe uma conta com este e-mail.";
  if (m.includes("password")) return "A senha não atende aos requisitos mínimos.";
  if (m.includes("email")) return "E-mail inválido.";
  return "Não foi possível criar a conta.";
}
