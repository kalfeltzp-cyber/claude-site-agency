import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedResult } from "@/lib/services/assessment";
import { ScoreHero, ResultDetails } from "@/components/results/result-summary";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Resultado compartilhado", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SharedResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getSharedResult(token);
  if (!result) notFound();
  return (
    <div className="container space-y-8 py-10 sm:py-14">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Resultado compartilhado</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Desempenho em uma avaliação Cognis</h1>
        <p className="mt-3 max-w-2xl text-muted">Resumo anônimo compartilhado pelo participante. Não inclui identificação nem respostas.</p>
      </div>
      <ScoreHero result={result} shared />
      <ResultDetails result={result} showTimes={false} />
      <div className="flex justify-center pt-4">
        <ButtonLink href="/avaliacao" size="lg">Fazer a avaliação</ButtonLink>
      </div>
    </div>
  );
}
