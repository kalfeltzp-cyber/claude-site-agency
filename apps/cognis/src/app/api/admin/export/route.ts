import { requireAdmin } from "@/lib/auth/session";
import { aggregatedExport, itemsToCsv } from "@/lib/services/admin-stats";
import { enforceRateLimit, handler } from "@/lib/security/http";

export const dynamic = "force-dynamic";

/** Exportação apenas de estatísticas agregadas (sem dados pessoais). */
export const GET = handler(async (req) => {
  enforceRateLimit(req, "admin");
  await requireAdmin();
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const data = await aggregatedExport();
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    return new Response(itemsToCsv(data.items), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cognis-itens-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="cognis-estatisticas-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
