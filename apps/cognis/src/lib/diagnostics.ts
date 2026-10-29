import "server-only";
import { db } from "./db/pool";
import { getConfig } from "./config";
import { blueprintSize } from "./engine/selection";

/**
 * Diagnóstico de configuração em linguagem simples. Nunca inclui segredos:
 * apenas o tipo de problema e como resolvê-lo.
 */

export type CheckStatus = "ok" | "erro" | "aviso";

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface Diagnosis {
  ok: boolean;
  checks: Check[];
}

/** Traduz erros de conexão/consulta do Postgres em causa provável + solução. */
export function explainDbError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const msg = (e?.message ?? "").toLowerCase();
  const code = e?.code ?? "";
  if (msg.includes("database_url não configurada")) {
    return "A variável DATABASE_URL não está cadastrada na Vercel. Cadastre-a em Settings → Environment Variables e faça Redeploy.";
  }
  if (code === "28P01" || msg.includes("password authentication failed")) {
    return "Senha do banco incorreta na DATABASE_URL. Troque [YOUR-PASSWORD] pela senha do banco (sem colchetes). Se a senha tiver caracteres especiais (@, #, /, :), redefina-a no Supabase com apenas letras e números.";
  }
  if (msg.includes("tenant or user not found") || (msg.includes("role") && msg.includes("does not exist"))) {
    return "Usuário da DATABASE_URL inválido. Copie novamente a URL do Supabase em Connect → Transaction pooler (o usuário tem o formato postgres.SEU_PROJETO).";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || msg.includes("getaddrinfo")) {
    return "Endereço do banco não encontrado. Use a URL do Transaction pooler (host terminado em pooler.supabase.com, porta 6543), não a conexão direta db.xxx.supabase.co.";
  }
  if (code === "ENETUNREACH" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || msg.includes("timeout")) {
    return "Não foi possível conectar ao banco. Use a URL do Transaction pooler (porta 6543) e verifique se o projeto do Supabase não está pausado.";
  }
  if (code === "3D000") return "O banco indicado na DATABASE_URL não existe. Use o nome padrão do Supabase: postgres.";
  if (code === "42P01" || (msg.includes("relation") && msg.includes("does not exist"))) {
    return "As tabelas não existem. Execute o arquivo supabase/setup-completo.sql no SQL Editor do Supabase (uma única vez).";
  }
  if (msg.includes("self-signed certificate") || msg.includes("certificate")) {
    return "Falha de certificado SSL. Remova DATABASE_SSL_CA ou confira o certificado informado.";
  }
  return "Erro inesperado ao acessar o banco. Confira a DATABASE_URL (Transaction pooler, porta 6543) e os logs da Vercel.";
}

export async function diagnose(): Promise<Diagnosis> {
  const cfg = getConfig();
  const checks: Check[] = [];
  const env = process.env;

  checks.push(
    env.DATABASE_URL
      ? {
          id: "env_database",
          label: "Variável DATABASE_URL",
          status: /:6543\//.test(env.DATABASE_URL) || /localhost|127\.0\.0\.1/.test(env.DATABASE_URL) ? "ok" : "aviso",
          detail: /:6543\//.test(env.DATABASE_URL) || /localhost|127\.0\.0\.1/.test(env.DATABASE_URL)
            ? "Cadastrada."
            : "Cadastrada, mas não usa a porta 6543. Na Vercel, prefira a URL do Transaction pooler do Supabase.",
        }
      : { id: "env_database", label: "Variável DATABASE_URL", status: "erro", detail: "Não cadastrada na Vercel." },
  );
  if (env.DATABASE_URL?.includes("[YOUR-PASSWORD]")) {
    checks.push({ id: "env_password", label: "Senha na DATABASE_URL", status: "erro", detail: "A URL ainda contém [YOUR-PASSWORD]. Troque pela senha do banco." });
  }

  const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supaUrl || supaKey) {
    const urlOk = Boolean(supaUrl && /^https:\/\/[^/]+$/.test(supaUrl.replace(/\/$/, "")));
    checks.push({
      id: "env_supabase",
      label: "Supabase Auth (URL e chave anon)",
      status: urlOk && supaKey ? "ok" : "erro",
      detail: !supaKey
        ? "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY."
        : urlOk
          ? "Cadastradas."
          : "NEXT_PUBLIC_SUPABASE_URL deve ser a Project URL completa, por exemplo https://abcd.supabase.co.",
    });
    checks.push({
      id: "env_service",
      label: "Chave service_role",
      status: env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "aviso",
      detail: env.SUPABASE_SERVICE_ROLE_KEY ? "Cadastrada." : "Não cadastrada: a exclusão de contas não funcionará.",
    });
  } else {
    checks.push({
      id: "env_supabase",
      label: "Supabase Auth",
      status: cfg.configErrors.length && cfg.isProduction ? "erro" : "aviso",
      detail: "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não cadastradas: login e cadastro não funcionarão em produção. A avaliação sem conta funciona.",
    });
  }
  checks.push({
    id: "env_site",
    label: "Variável NEXT_PUBLIC_SITE_URL",
    status: env.NEXT_PUBLIC_SITE_URL ? "ok" : "aviso",
    detail: env.NEXT_PUBLIC_SITE_URL ? "Cadastrada." : "Não cadastrada: links de confirmação de e-mail podem apontar para o endereço errado.",
  });

  if (env.DATABASE_URL) {
    try {
      await db.query("select 1");
      checks.push({ id: "db_connect", label: "Conexão com o banco", status: "ok", detail: "Conectado." });
      try {
        const [v] = await db.query<{ id: string; blueprint: Parameters<typeof blueprintSize>[0] }>(
          "select id, blueprint from public.test_versions where status = 'active' limit 1",
        );
        const [q] = await db.query<{ n: number }>("select count(*)::int as n from public.questions where active and status = 'reviewed'");
        checks.push({ id: "db_tables", label: "Tabelas do Cognis", status: "ok", detail: "Encontradas." });
        checks.push(
          v && q.n >= blueprintSize(v.blueprint)
            ? { id: "db_content", label: "Questões e versão ativa", status: "ok", detail: `${q.n} questões ativas; versão ${v.id}.` }
            : {
                id: "db_content",
                label: "Questões e versão ativa",
                status: "erro",
                detail: "O conteúdo não foi carregado. Execute supabase/setup-completo.sql no SQL Editor do Supabase (ou supabase/seed.sql se as tabelas já existem).",
              },
        );
      } catch (err) {
        checks.push({ id: "db_tables", label: "Tabelas do Cognis", status: "erro", detail: explainDbError(err) });
      }
    } catch (err) {
      console.error("[diagnóstico] falha de conexão:", (err as Error).message);
      checks.push({ id: "db_connect", label: "Conexão com o banco", status: "erro", detail: explainDbError(err) });
    }
  }

  return { ok: checks.every((c) => c.status !== "erro"), checks };
}
