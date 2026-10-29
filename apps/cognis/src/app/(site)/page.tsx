import Link from "next/link";
import { loadCategories, loadQuestions, loadTestVersions } from "@/lib/questions/bank";
import { blueprintSize } from "@/lib/engine/selection";
import { FigureMatrix } from "@/components/figures/figure";
import { ButtonLink } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";

export const dynamic = "force-static";

const STEPS = [
  { n: "01", title: "Leia como funciona", text: "Regras, duração e o que o resultado significa — antes de começar." },
  { n: "02", title: "Responda às questões", text: "36 itens originais, em ordem crescente de dificuldade, com salvamento automático." },
  { n: "03", title: "Correção no servidor", text: "O gabarito nunca chega ao navegador. A pontuação é calculada e registrada no servidor." },
  { n: "04", title: "Analise o desempenho", text: "Índice geral, categorias, dificuldade, tempo por questão e revisão comentada." },
];

export default function HomePage() {
  const categories = loadCategories();
  const bankSize = loadQuestions().length;
  const version = loadTestVersions().find((v) => v.status === "active")!;
  const size = blueprintSize(version.blueprint);

  return (
    <>
      <section className="relative overflow-hidden border-b border-line/70">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="hero-glow absolute inset-0" aria-hidden />
        <div className="container relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.25fr_1fr]">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-good" aria-hidden /> Avaliação experimental · metodologia aberta
            </p>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Meça seu raciocínio <span className="bg-gradient-to-r from-accent to-violet bg-clip-text pr-2 italic text-transparent">com honestidade</span> científica.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Questões originais de lógica, padrões, números, espaço, linguagem e memória. Correção automática, análise detalhada do
              desempenho — e transparência sobre o que o resultado <em>não</em> significa.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/avaliacao" size="lg">Começar avaliação</ButtonLink>
              <ButtonLink href="/como-funciona" size="lg" variant="secondary">Como funciona</ButtonLink>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-line/70 pt-6">
              {[
                [String(size), "questões por avaliação"],
                ["25–35", "minutos, em média"],
                [String(categories.length), "categorias de raciocínio"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-mono text-3xl font-semibold tabular-nums">{v}</dd>
                  <dd className="mt-1 text-xs leading-snug text-muted">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Card className="relative p-5 sm:p-7">
            <p className="mb-4 flex items-center justify-between text-xs text-faint">
              <span className="uppercase tracking-[0.18em]">Exemplo de formato</span>
              <span>não pontuado</span>
            </p>
            <FigureMatrix
              cells={[
                { shape: "diamond", fill: "outline", rotation: 0, mirror: false, count: 1 },
                { shape: "diamond", fill: "outline", rotation: 0, mirror: false, count: 2 },
                { shape: "diamond", fill: "outline", rotation: 0, mirror: false, count: 3 },
                { shape: "hexagon", fill: "striped", rotation: 0, mirror: false, count: 1 },
                { shape: "hexagon", fill: "striped", rotation: 0, mirror: false, count: 2 },
                { shape: "hexagon", fill: "striped", rotation: 0, mirror: false, count: 3 },
                { shape: "star", fill: "solid", rotation: 0, mirror: false, count: 1 },
                { shape: "star", fill: "solid", rotation: 0, mirror: false, count: 2 },
                null,
              ]}
            />
            <p className="mt-4 text-sm text-muted">Qual figura completa a matriz? Descubra a regra que muda em cada linha e coluna.</p>
          </Card>
        </div>
      </section>

      <section className="container py-20" aria-labelledby="processo">
        <h2 id="processo" className="font-display text-4xl">Como a avaliação funciona</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-accent/40">
              <span className="font-mono text-sm text-accent">{s.n}</span>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line/70 bg-surface/40 py-20" aria-labelledby="categorias">
        <div className="container">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="categorias" className="font-display text-4xl">O que é avaliado</h2>
              <p className="mt-3 max-w-2xl text-muted">
                Cada avaliação sorteia {size} itens de um banco de {bankSize} questões originais, seguindo uma matriz fixa de categorias e
                níveis de dificuldade.
              </p>
            </div>
            <Link href="/metodologia" className="text-sm text-accent underline underline-offset-4">Fundamentação teórica</Link>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line bg-surface p-5">
                <h3 className="font-semibold">{c.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container grid gap-10 py-20 lg:grid-cols-2" aria-labelledby="honestidade">
        <div>
          <h2 id="honestidade" className="font-display text-4xl">Por que não mostramos um “QI”</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Um QI é um escore padronizado: compara você com uma amostra representativa da população, usando normas coletadas com
            rigor e evidências de validade e confiabilidade. O Cognis ainda não tem esses dados. Por isso, apresentamos um{" "}
            <strong className="text-ink">Índice de Desempenho Cognitivo</strong> — o percentual de acertos nesta avaliação — e
            explicamos exatamente como ele é calculado.
          </p>
          <div className="mt-6 flex gap-3">
            <ButtonLink href="/metodologia" variant="secondary">Metodologia científica</ButtonLink>
            <ButtonLink href="/referencias" variant="ghost">Referências</ButtonLink>
          </div>
        </div>
        <div className="space-y-4">
          <Notice title="O que o resultado é">Uma descrição do seu desempenho em uma avaliação específica, por categoria e dificuldade.</Notice>
          <Notice tone="warn" title="O que o resultado não é">
            Um QI clínico, um diagnóstico, uma medida do seu potencial ou do seu valor, nem base para decisões médicas, educacionais ou profissionais.
          </Notice>
          <Notice tone="good" title="Seus dados">Sem cadastro obrigatório. Com conta, você pode exportar ou excluir tudo a qualquer momento.</Notice>
        </div>
      </section>

      <section className="container pb-8">
        <Card className="relative overflow-hidden p-10 text-center sm:p-14">
          <div className="hero-glow absolute inset-0" aria-hidden />
          <div className="relative">
            <h2 className="font-display text-4xl sm:text-5xl">Pronto para começar?</h2>
            <p className="mx-auto mt-4 max-w-lg text-muted">Reserve cerca de 30 minutos em um ambiente tranquilo. Você pode pausar e retomar dentro do tempo limite.</p>
            <ButtonLink href="/avaliacao" size="lg" className="mt-8">Começar avaliação</ButtonLink>
          </div>
        </Card>
      </section>
    </>
  );
}
