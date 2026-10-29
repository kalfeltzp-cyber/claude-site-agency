import type { Metadata } from "next";
import Link from "next/link";
import { platformSummary } from "@/lib/services/admin-stats";
import { ScoreHero, ResultDetails } from "@/components/results/result-summary";
import { ShareButton } from "@/components/results/share-button";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { loadOwnResult } from "./load";

export const metadata: Metadata = { title: "Seu resultado", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnResult(id);
  const [platform, user] = await Promise.all([platformSummary(result.testVersionId), getCurrentUser()]);

  return (
    <div className="container space-y-8 py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Resultado</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Análise do seu desempenho</h1>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <ButtonLink href={`/resultado/${id}/relatorio`}>Relatório completo</ButtonLink>
          <ButtonLink href="/avaliacao" variant="secondary">Fazer outra avaliação</ButtonLink>
        </div>
      </div>

      {result.status === "expired" && (
        <Notice tone="warn" title="Tempo esgotado">
          O tempo limite terminou antes do encerramento. As questões sem resposta foram contadas como não respondidas.
        </Notice>
      )}

      <ScoreHero result={result} />
      <ResultDetails result={result} platform={platform} />

      <section className="grid gap-6 rounded-2xl border border-line p-6 md:grid-cols-2 no-print">
        <div>
          <h2 className="font-display text-2xl">Compartilhar</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Gere um link público e anônimo com o resumo deste resultado.</p>
          <ShareButton attemptId={id} initiallyShared={result.isShared} />
        </div>
        <div>
          <h2 className="font-display text-2xl">Guardar histórico</h2>
          {user ? (
            <p className="mt-1 text-sm text-muted">
              Este resultado está salvo na sua conta. Veja a evolução no <Link href="/historico" className="text-accent underline">histórico</Link>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Sem conta, o resultado fica associado apenas a este navegador. <Link href="/entrar?modo=cadastro" className="text-accent underline">Crie uma conta</Link> para guardá-lo e acompanhar sua evolução — as avaliações deste navegador são vinculadas automaticamente.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
