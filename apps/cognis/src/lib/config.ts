import "server-only";

/**
 * Configuração do servidor a partir de variáveis de ambiente.
 * Nenhum segredo daqui pode ser importado por componentes de cliente
 * (o pacote "server-only" quebra o build se isso acontecer).
 */

export type AuthMode = "supabase" | "local";

export interface ServerConfig {
  databaseUrl: string | null;
  authMode: AuthMode;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseServiceRoleKey: string | null;
  adminEmails: string[];
  sessionSecret: string | null;
  siteUrl: string;
  isProduction: boolean;
  configErrors: string[];
}

let cached: ServerConfig | null = null;

export function getConfig(): ServerConfig {
  if (cached) return cached;
  const env = process.env;
  const isProduction = env.NODE_ENV === "production";
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || null;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || null;
  const allowLocal = env.COGNIS_ALLOW_LOCAL_AUTH === "true";
  const errors: string[] = [];

  let authMode: AuthMode;
  if (supabaseUrl && supabaseAnonKey) {
    authMode = "supabase";
    if (!supabaseServiceRoleKey) errors.push("SUPABASE_SERVICE_ROLE_KEY ausente: exclusão de contas indisponível.");
  } else {
    authMode = "local";
    if (isProduction && !allowLocal) {
      errors.push(
        "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY " +
          "(ou COGNIS_ALLOW_LOCAL_AUTH=true apenas para testes).",
      );
    }
  }
  if (!env.DATABASE_URL) errors.push("DATABASE_URL não configurada.");
  if (authMode === "local" && !env.SESSION_SECRET && isProduction) {
    errors.push("SESSION_SECRET é obrigatório no modo de autenticação local em produção.");
  }

  cached = {
    databaseUrl: env.DATABASE_URL || null,
    authMode,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    adminEmails: (env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    sessionSecret: env.SESSION_SECRET || (isProduction ? null : "dev-only-insecure-session-secret"),
    siteUrl: (env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
    isProduction,
    configErrors: errors,
  };
  return cached;
}

export class ConfigError extends Error {}

export function requireDatabaseUrl(): string {
  const { databaseUrl } = getConfig();
  if (!databaseUrl) throw new ConfigError("DATABASE_URL não configurada.");
  return databaseUrl;
}
