import { diagnose } from "@/lib/diagnostics";
import { json } from "@/lib/security/http";

export const dynamic = "force-dynamic";

/** Saúde e diagnóstico de configuração (sem segredos). Versão legível em /status. */
export async function GET() {
  const d = await diagnose();
  const database = d.checks.find((c) => c.id === "db_connect")?.status === "ok" ? "up" : "down";
  return json({ ok: d.ok, database, checks: d.checks }, { status: d.ok ? 200 : 503 });
}
