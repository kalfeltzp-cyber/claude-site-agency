import type { Metadata } from "next";
import { adminGuard } from "@/lib/auth/guard";
import { overview } from "@/lib/services/admin-stats";
import { formatDuration, formatNum, formatPct, t } from "@/lib/i18n";
import { MIN_PLATFORM_SAMPLE } from "@/lib/stats/descriptive";
import { AdminHeader } from "@/components/admin/admin-nav";
import { Card, Notice, Stat } from "@/components/ui/card";
import { Histogram } from "@/components/charts/histogram";
import { PercentBars } from "@/components/charts/percent-bars";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Admin · Visão geral", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await adminGuard("/admin");
  const ov = await overview();
  return (
    <div className="container pb-16">
      <AdminHeader title="Visão geral" active="/admin">
        <div className="flex gap-2">
          <a href="/api/admin/export?format=json" className={buttonClass("secondary", "sm")} download>Exportar JSON</a>
          <a href="/api/admin/export?format=csv" className={buttonClass("secondary", "sm")} download>Exportar CSV (itens)</a>
        </div>
      </AdminHeader>
      <Notice className="mt-6">Somente métricas agregadas. Nenhuma tela do painel exibe resultados individuais identificados.</Notice>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Usuários" value={ov.users} />
        <Stat label="Iniciadas" value={ov.started} />
        <Stat label="Concluídas" value={ov.finished} hint={`${ov.completed} no prazo · ${ov.expired} por tempo`} />
        <Stat label="Abandonadas" value={ov.abandoned} />
        <Stat label="Em andamento" value={ov.inProgress} />
        <Stat label="Taxa de conclusão" value={ov.completionRate === null ? "—" : formatPct(ov.completionRate)} hint="concluídas ÷ encerradas" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-2xl">Distribuição do IDC</h2>
          <p className="mb-5 mt-1 text-sm text-muted">
            {ov.summary.n} avaliações concluídas.{" "}
            {ov.summary.sufficient
              ? `Média ${formatNum(ov.summary.mean!)}, mediana ${formatNum(ov.summary.median!)}, DP ${formatNum(ov.summary.sd!)}.`
              : `Média e mediana exibidas a partir de ${MIN_PLATFORM_SAMPLE} avaliações.`}
            {ov.meanTotalTimeMs !== null && ` Tempo médio: ${formatDuration(ov.meanTotalTimeMs)}.`}
          </p>
          <Histogram bins={ov.summary.distribution} caption="Distribuição do índice de desempenho" />
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-2xl">Acerto médio por categoria</h2>
            <p className="mb-5 mt-1 text-sm text-muted">Sobre todas as questões apresentadas em avaliações concluídas.</p>
            <PercentBars caption="Acerto por categoria" rows={ov.byCategory.map((c) => ({ key: c.category, label: c.name, percent: c.percentCorrect, detail: `n=${c.responses}` }))} />
          </Card>
          <Card className="p-6">
            <h2 className="font-display text-2xl">Acerto por dificuldade</h2>
            <div className="mt-5">
              <PercentBars caption="Acerto por dificuldade" rows={ov.byDifficulty.map((d) => ({ key: String(d.difficulty), label: t.difficulty[d.difficulty], percent: d.percentCorrect, detail: `n=${d.responses}` }))} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
