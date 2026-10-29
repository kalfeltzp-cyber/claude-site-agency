import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, getOwner } from "@/lib/auth/session";
import { listHistory } from "@/lib/services/assessment";
import { formatDate, formatDuration, formatNum, t } from "@/lib/i18n";
import { HistoryChart } from "@/components/charts/history-chart";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Histórico", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [owner, user] = await Promise.all([getOwner(), getCurrentUser()]);
  const history = await listHistory(owner);
  const finished = history.filter((h) => h.performanceIndex !== null).slice().reverse();

  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Histórico" title="Suas avaliações">
        {user ? "Todas as tentativas associadas à sua conta." : "Tentativas feitas neste navegador. Crie uma conta para guardá-las de forma permanente."}
      </PageHeader>

      {!user && history.length > 0 && (
        <Notice className="mt-8" title="Histórico temporário">
          Sem conta, o histórico depende de um cookie deste navegador (válido por 30 dias).{" "}
          <Link href="/entrar?modo=cadastro&next=/historico" className="text-accent underline">Criar conta e vincular estas avaliações</Link>.
        </Notice>
      )}

      {history.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Nenhuma avaliação ainda" action={<ButtonLink href="/avaliacao">Começar avaliação</ButtonLink>}>
            Quando você concluir uma avaliação, o resultado aparecerá aqui.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-10 space-y-8">
          {finished.length >= 2 && (
            <Card className="p-6">
              <h2 className="font-display text-2xl">Evolução entre tentativas</h2>
              <p className="mb-4 mt-1 text-sm text-muted">
                Índice de Desempenho Cognitivo por tentativa concluída. Repetir a avaliação gera efeito de prática (familiaridade com os formatos e possíveis itens repetidos), então ganhos não indicam necessariamente mudança de habilidade.
              </p>
              <HistoryChart points={finished.map((h, i) => ({ date: h.completedAt!, value: h.performanceIndex!, label: `Tentativa ${i + 1}` }))} />
            </Card>
          )}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Lista de avaliações</caption>
                <thead className="bg-surface-2 text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Início</th>
                    <th scope="col" className="px-5 py-3 font-medium">Situação</th>
                    <th scope="col" className="px-5 py-3 font-medium">IDC</th>
                    <th scope="col" className="px-5 py-3 font-medium">Acertos</th>
                    <th scope="col" className="px-5 py-3 font-medium">Tempo</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.attemptId} className="border-t border-line">
                      <td className="px-5 py-3">{formatDate(h.startedAt)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={h.status === "completed" ? "good" : h.status === "in_progress" ? "accent" : h.status === "expired" ? "warn" : "neutral"}>
                          {t.status[h.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 font-mono tabular-nums">{h.performanceIndex === null ? "—" : formatNum(h.performanceIndex)}</td>
                      <td className="px-5 py-3 font-mono tabular-nums">{h.correct === null ? "—" : `${h.correct}/${h.totalItems}`}</td>
                      <td className="px-5 py-3 font-mono tabular-nums">{h.totalTimeMs === null ? "—" : formatDuration(h.totalTimeMs)}</td>
                      <td className="px-5 py-3 text-right">
                        {h.status === "in_progress" ? (
                          <Link href={`/avaliacao/${h.attemptId}`} className="text-accent hover:underline">Continuar</Link>
                        ) : h.performanceIndex !== null ? (
                          <Link href={`/resultado/${h.attemptId}`} className="text-accent hover:underline">Ver resultado</Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
