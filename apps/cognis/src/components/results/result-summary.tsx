import Link from "next/link";
import type { ResultView } from "@/lib/services/assessment";
import type { PlatformSummary } from "@/lib/services/admin-stats";
import { observations } from "@/lib/engine/scoring";
import { formatDate, formatDuration, formatNum, formatPct, t } from "@/lib/i18n";
import { MIN_PLATFORM_SAMPLE } from "@/lib/stats/descriptive";
import { Badge, Card, Notice, Stat } from "../ui/card";
import { OutcomeBar } from "../charts/outcome-bar";
import { PercentBars } from "../charts/percent-bars";
import { Histogram } from "../charts/histogram";
import { TimeStrip } from "../charts/time-strip";

export function ScoreHero({ result, shared = false }: { result: ResultView; shared?: boolean }) {
  const s = result.score;
  return (
    <Card className="relative overflow-hidden p-6 sm:p-10">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent">{t.scoreName}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-7xl leading-none tabular-nums sm:text-8xl">{formatNum(s.performanceIndex)}</span>
            <span className="font-mono text-lg text-faint">/ 100</span>
          </p>
          <p className="mt-3 text-muted">
            {s.correct} {s.correct === 1 ? "acerto" : "acertos"} em {s.totalItems} questões
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={result.status === "expired" ? "warn" : "good"}>{t.status[result.status]}</Badge>
            <Badge>Versão {result.testVersionId}</Badge>
            <Badge>Pontuação {s.scoringVersion}</Badge>
            {!shared && <Badge>{formatDate(result.completedAt)}</Badge>}
          </div>
          <OutcomeBar correct={s.correct} incorrect={s.incorrect} unanswered={s.unanswered} />
          <p className="text-sm leading-relaxed text-muted">
            O IDC é a porcentagem de questões respondidas corretamente nesta avaliação. {t.disclaimer}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function ResultDetails({ result, platform, showTimes = true }: { result: ResultView; platform?: PlatformSummary | null; showTimes?: boolean }) {
  const s = result.score;
  const obs = observations(s);
  const name = (id: string) => result.categoryNames[id] ?? id;
  const categoryRows = s.byCategory
    .slice()
    .sort((a, b) => b.percentCorrect - a.percentCorrect || name(a.category).localeCompare(name(b.category)))
    .map((c) => ({ key: c.category, label: name(c.category), percent: c.percentCorrect, detail: `${c.correct}/${c.total}` }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Corretas" value={s.correct} />
        <Stat label="Incorretas" value={s.incorrect} />
        <Stat label="Não respondidas" value={s.unanswered} />
        <Stat label="Acertos" value={formatPct(s.percentCorrect)} />
        <Stat label="Tempo total" value={formatDuration(s.totalTimeMs)} />
        <Stat label="Média por questão" value={formatDuration(s.meanTimeMs)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <h2 className="font-display text-2xl">Desempenho por categoria</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Percentual de acertos e número de itens. Com 3–4 itens por categoria, cada questão altera o percentual em 25–33 pontos.</p>
          <PercentBars rows={categoryRows} caption="Percentual de acertos por categoria" reference={{ value: s.percentCorrect, label: `Seu percentual geral (${formatPct(s.percentCorrect)})` }} />
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-2xl">Por nível de dificuldade</h2>
            <p className="mb-5 mt-1 text-sm text-muted">Níveis atribuídos pelos autores, ainda não calibrados com dados.</p>
            <PercentBars
              rows={s.byDifficulty.map((d) => ({ key: String(d.difficulty), label: t.difficulty[d.difficulty], percent: d.percentCorrect, detail: `${d.correct}/${d.total}` }))}
              caption="Percentual de acertos por dificuldade"
            />
          </Card>
          <Card className="p-6">
            <h2 className="font-display text-2xl">Como interpretar</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li>O índice resume esta tentativa. Sono, atenção, familiaridade com o formato e o idioma influenciam o resultado.</li>
              <li>Não há comparação com a população geral: o Cognis não possui normas validadas.</li>
              <li>Diferenças pequenas entre tentativas ou categorias podem refletir apenas o sorteio de questões.</li>
            </ul>
            <Link href="/metodologia" className="mt-3 inline-block text-sm text-accent underline underline-offset-2">Metodologia de pontuação</Link>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-2xl">Pontos fortes nesta tentativa</h2>
          {obs.strengths.length ? (
            <ul className="mt-4 space-y-3">
              {obs.strengths.map((c) => (
                <li key={c.category} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                  <span><span aria-hidden className="mr-2 text-good">✓</span>{name(c.category)}</span>
                  <span className="font-mono text-sm text-muted">{c.correct}/{c.total}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Nenhuma categoria atingiu 75% de acertos nesta tentativa.</p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-2xl">Menor desempenho nesta tentativa</h2>
          {obs.lowerPerformance.length ? (
            <ul className="mt-4 space-y-4">
              {obs.lowerPerformance.map((c) => (
                <li key={c.category} className="rounded-xl border border-line p-3">
                  <p className="flex items-center justify-between gap-3">
                    <span>{name(c.category)}</span>
                    <span className="font-mono text-sm text-muted">{c.correct}/{c.total}</span>
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-faint">Sugestões de prática</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                    {(result.categoryPractice[c.category] ?? []).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Nenhuma categoria ficou em 50% de acertos ou menos.</p>
          )}
        </Card>
      </div>

      {showTimes && result.items.length > 0 && (
        <Card className="p-6">
          <h2 className="font-display text-2xl">Tempo por questão</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Tempo em que cada questão esteve aberta na tela, na ordem de apresentação.</p>
          <TimeStrip items={result.items.map((i) => ({ position: i.position, timeSpentMs: i.timeSpentMs, isCorrect: i.isCorrect, category: i.categoryName }))} />
        </Card>
      )}

      {platform && (
        <Card className="p-6">
          <h2 className="font-display text-2xl">Resultados na plataforma</h2>
          {platform.sufficient ? (
            <>
              <p className="mb-5 mt-1 text-sm text-muted">
                Distribuição dos índices de {platform.n} avaliações concluídas nesta versão. Média {formatNum(platform.mean!)}; mediana {formatNum(platform.median!)}.
                Quem usa a plataforma não é uma amostra representativa da população: isto não é uma norma nem um percentil populacional.
              </p>
              <Histogram bins={platform.distribution} caption="Distribuição dos índices na plataforma" highlight={s.performanceIndex} />
            </>
          ) : (
            <Notice className="mt-3" title="Dados insuficientes">
              Ainda há apenas {platform.n} avaliação(ões) concluída(s) nesta versão. Médias e distribuições só são exibidas a partir de {MIN_PLATFORM_SAMPLE}, e mesmo assim não representam a população geral.
            </Notice>
          )}
        </Card>
      )}
    </div>
  );
}
