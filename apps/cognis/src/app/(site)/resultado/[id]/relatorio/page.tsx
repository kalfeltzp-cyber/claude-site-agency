import type { Metadata } from "next";
import { ScoreHero, ResultDetails } from "@/components/results/result-summary";
import { ItemReview } from "@/components/results/item-review";
import { PrintButton } from "@/components/results/print-button";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { formatDate } from "@/lib/i18n";
import { loadOwnResult } from "../load";

export const metadata: Metadata = { title: "Relatório completo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnResult(id);
  return (
    <div className="container max-w-5xl space-y-8 py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Relatório completo</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Avaliação de {formatDate(result.completedAt)}</h1>
          <p className="mt-2 font-mono text-xs text-faint">Tentativa {result.attemptId}</p>
        </div>
        <div className="flex gap-2 no-print">
          <PrintButton />
          <ButtonLink href={`/resultado/${id}`} variant="ghost">Voltar ao resumo</ButtonLink>
        </div>
      </div>
      <ScoreHero result={result} />
      <ResultDetails result={result} />
      <section>
        <h2 className="font-display text-3xl">Revisão das questões</h2>
        <p className="mb-6 mt-2 text-muted">Gabarito e explicação de cada item apresentado. Por favor, não divulgue as respostas: isso compromete avaliações futuras.</p>
        <ItemReview items={result.items} />
      </section>
      <Notice tone="warn" title="Limitações">
        Relatório de uma avaliação experimental, sem normas populacionais e sem evidências de validade para uso clínico, educacional
        ou profissional. Não use este documento para diagnóstico ou seleção de pessoas.
      </Notice>
    </div>
  );
}
