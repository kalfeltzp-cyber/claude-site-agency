import type { Metadata } from "next";
import Link from "next/link";
import { loadQuestions, loadTestVersions } from "@/lib/questions/bank";
import { blueprintSize } from "@/lib/engine/selection";
import { SCORING_VERSION } from "@/lib/engine/scoring";
import { MIN_PLATFORM_SAMPLE } from "@/lib/stats/descriptive";
import { MIN_ITEM_SAMPLE } from "@/lib/stats/items";
import { MIN_NORM_SAMPLE } from "@/lib/engine/norms";
import { Notice, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Metodologia científica",
  description:
    "Como o Cognis constrói questões, monta a avaliação, calcula o Índice de Desempenho Cognitivo e por que não apresenta um QI. Limitações e referências.",
  alternates: { canonical: "/metodologia" },
};
export const dynamic = "force-static";

function Ref({ id, children }: { id: string; children: React.ReactNode }) {
  return <Link href={`/referencias#${id}`}>{children}</Link>;
}

const SECTIONS = [
  ["proposito", "Propósito"],
  ["teoria", "Base teórica"],
  ["itens", "Construção das questões"],
  ["montagem", "Montagem da avaliação"],
  ["pontuacao", "Pontuação"],
  ["qi", "Por que não há “QI”"],
  ["estatisticas", "Estatísticas da plataforma"],
  ["calibracao", "Caminho para calibração"],
  ["limitacoes", "Limitações"],
  ["uso", "Uso apropriado"],
];

export default function MethodologyPage() {
  const questions = loadQuestions();
  const version = loadTestVersions().find((v) => v.status === "active")!;
  const size = blueprintSize(version.blueprint);

  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Metodologia científica" title="Como medimos — e o que não afirmamos">
        Esta página descreve, em linguagem acessível, o método de construção, aplicação e pontuação do Cognis, suas limitações e as
        fontes em que ele se apoia.
      </PageHeader>

      <div className="mt-12 grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Seções da metodologia" className="hidden lg:block">
          <ol className="sticky top-24 space-y-2 text-sm">
            {SECTIONS.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} className="text-muted hover:text-ink">
                  <span className="mr-2 font-mono text-faint">{String(i + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="prose-cognis max-w-3xl">
          <Notice tone="warn" title="Resumo">
            O Cognis é um <strong>instrumento experimental</strong>. Ele produz um Índice de Desempenho Cognitivo (percentual de
            acertos) e análises descritivas. Não possui normas populacionais, estudos de validade nem estimativas de fidedignidade
            publicadas; por isso não apresenta QI, percentis populacionais ou classificações.
          </Notice>

          <h2 id="proposito">1. Propósito</h2>
          <p>
            Oferecer uma avaliação gratuita e transparente de tarefas de raciocínio, com correção automática e retorno detalhado,
            para autoconhecimento e prática. O produto foi desenhado seguindo princípios das{" "}
            <Ref id="aera-2014">Standards for Educational and Psychological Testing</Ref> e das diretrizes da International Test
            Commission para uso de testes e testagem pela internet (<Ref id="itc-2001">ITC, 2001</Ref>;{" "}
            <Ref id="itc-2006">ITC, 2006</Ref>), especialmente quanto à comunicação honesta do significado dos escores.
          </p>

          <h2 id="teoria">2. Base teórica</h2>
          <p>
            As categorias se inspiram no modelo Cattell–Horn–Carroll (CHC) de habilidades cognitivas (<Ref id="carroll-1993">Carroll, 1993</Ref>;{" "}
            <Ref id="mcgrew-2009">McGrew, 2009</Ref>), que organiza as habilidades em fatores amplos como raciocínio fluido (Gf),
            conhecimento cristalizado (Gc), processamento visuoespacial (Gv), memória de trabalho (Gwm) e conhecimento quantitativo
            (Gq). A distinção entre raciocínio fluido e cristalizado remonta a <Ref id="cattell-1963">Cattell (1963)</Ref>.
          </p>
          <ul>
            <li><strong>Matrizes e sequências figurais</strong> usam tipos de regra descritos na análise de <Ref id="carpenter-1990">Carpenter, Just e Shell (1990)</Ref>: progressão constante, distribuição de três valores e adição.</li>
            <li><strong>Rotação e reflexão</strong> adaptam ao plano o paradigma de rotação mental de <Ref id="shepard-1971">Shepard e Metzler (1971)</Ref>.</li>
            <li><strong>Memória de trabalho</strong> segue a noção de armazenamento e manipulação breve de <Ref id="baddeley-2003">Baddeley (2003)</Ref>; os estímulos têm de 4 a 8 elementos, faixa compatível com os limites de capacidade discutidos por <Ref id="miller-1956">Miller (1956)</Ref> e <Ref id="cowan-2001">Cowan (2001)</Ref>.</li>
            <li><strong>Analogias verbais</strong> dependem de vocabulário e, portanto, de conhecimento cristalizado e de familiaridade com o português brasileiro.</li>
          </ul>
          <p>
            Revisões gerais sobre o que testes de inteligência medem, e seus limites, estão em <Ref id="neisser-1996">Neisser et al. (1996)</Ref>,{" "}
            <Ref id="deary-2012">Deary (2012)</Ref> e <Ref id="nisbett-2012">Nisbett et al. (2012)</Ref>.
          </p>

          <h2 id="itens">3. Construção das questões</h2>
          <p>
            O banco atual tem <strong>{questions.length} questões originais</strong>, escritas para o Cognis — nenhuma foi copiada de
            testes comerciais ou instrumentos protegidos. A redação seguiu diretrizes de itens de múltipla escolha de{" "}
            <Ref id="haladyna-2002">Haladyna, Downing e Rodriguez (2002)</Ref>: uma única resposta defensável, distratores plausíveis
            que representam erros típicos, enunciados sem pistas.
          </p>
          <p>Cada questão registra:</p>
          <ul>
            <li>identificador, versão, categoria, nível de dificuldade e formato;</li>
            <li>enunciado, alternativas, gabarito e explicação da solução;</li>
            <li>justificativa técnica (regra ou paradigma envolvido) e tempo recomendado;</li>
            <li>estado de revisão e indicadores de qualidade.</li>
          </ul>
          <p>
            Todas passaram por revisão do autor. Além disso, um conjunto de testes automatizados <strong>recalcula de forma independente</strong>{" "}
            os gabaritos de itens numéricos, alfabéticos, de memória, de enumeração lógica e das regras das matrizes, e verifica que
            nenhum distrator satisfaz todas as regras. Isso reduz erros de gabarito, mas não substitui revisão por especialistas
            independentes nem análise empírica dos itens.
          </p>
          <p>
            Os níveis <em>fácil</em>, <em>médio</em> e <em>difícil</em> foram atribuídos pelos autores com base no número de regras e
            passos envolvidos. São hipóteses a serem verificadas com dados, não parâmetros calibrados.
          </p>

          <h2 id="montagem">4. Montagem da avaliação</h2>
          <p>
            A versão ativa (<code>{version.id}</code>) apresenta <strong>{size} questões</strong> com limite de{" "}
            {Math.round(version.timeLimitSeconds / 60)} minutos. As questões são sorteadas por um gerador pseudoaleatório com semente
            registrada no banco de dados, segundo uma matriz categoria × dificuldade. O mesmo sorteio pode ser reproduzido a partir da
            semente. A ordem das alternativas também é embaralhada. Não há repetição de questões na mesma tentativa, e a ordem vai
            do nível fácil ao difícil, evitando duas questões seguidas da mesma categoria.
          </p>
          <p>
            Esses números (quantidade de questões, duração, distribuição) são <strong>parâmetros de produto</strong> escolhidos para uma
            experiência de 25 a 35 minutos, e não padrões científicos universais.
          </p>

          <h2 id="pontuacao">5. Pontuação (algoritmo {SCORING_VERSION})</h2>
          <p>A correção acontece exclusivamente no servidor. O algoritmo é:</p>
          <ol>
            <li>cada questão vale 1 ponto se a alternativa escolhida for o gabarito e 0 caso contrário;</li>
            <li>questões não respondidas valem 0 e são contadas separadamente;</li>
            <li><strong>IDC = 100 × acertos ÷ total de questões apresentadas</strong>, com uma casa decimal;</li>
            <li>os resultados por categoria e por dificuldade usam a mesma regra dentro de cada grupo.</li>
          </ol>
          <p>
            A dificuldade <strong>não pondera</strong> o escore. Atribuir pesos maiores a itens “difíceis” só seria tecnicamente
            justificável com parâmetros estimados empiricamente (por exemplo, via Teoria de Resposta ao Item); com níveis apenas
            atribuídos pelos autores, pesos seriam arbitrários e dariam uma falsa impressão de precisão.
          </p>
          <p>
            Pontos fortes são categorias com pelo menos 75% de acerto; categorias de menor desempenho são as com até 50%. Como cada
            categoria tem só 3 ou 4 questões, esses rótulos descrevem a tentativa, não um perfil estável.
          </p>

          <h2 id="qi">6. Por que não há “QI”</h2>
          <p>
            Um QI é um <strong>escore padronizado</strong> (em geral com média 100 e desvio-padrão 15) obtido comparando o desempenho
            de uma pessoa ao de uma amostra normativa representativa, com procedimentos de aplicação controlados. Para isso são
            necessários: normas atualizadas e específicas da população e da época (<Ref id="flynn-1987">Flynn, 1987</Ref>), evidências
            de confiabilidade e de validade das interpretações (<Ref id="messick-1995">Messick, 1995</Ref>;{" "}
            <Ref id="aera-2014">AERA, APA e NCME, 2014</Ref>) e, no Brasil, a aprovação de testes psicológicos para uso profissional
            pelo Conselho Federal de Psicologia por meio do SATEPSI (<Ref id="cfp-2022">Resolução CFP nº 31/2022</Ref>).
          </p>
          <p>
            O Cognis não tem nada disso ainda. Transformar o percentual de acertos em “QI 120” por meio de uma fórmula seria inventar
            uma equivalência sem fundamento estatístico. Por isso a interface nunca exibe QI, percentis populacionais ou
            classificações como “superior” ou “acima da média”.
          </p>

          <h2 id="estatisticas">7. Estatísticas da plataforma</h2>
          <p>Para acompanhar a qualidade dos itens, o painel administrativo calcula, pela teoria clássica dos testes:</p>
          <ul>
            <li><strong>índice de dificuldade (p)</strong>: proporção de acertos entre quem viu a questão;</li>
            <li><strong>discriminação (r<sub>it</sub> corrigido)</strong>: correlação entre acertar a questão e o desempenho no restante da avaliação;</li>
            <li><strong>frequência de cada alternativa</strong> e taxa de omissão;</li>
            <li><strong>alertas</strong>: questão muito fácil (p &gt; 0,90) ou muito difícil (p &lt; 0,20), discriminação baixa ou negativa, e distratores escolhidos pelos participantes de melhor desempenho tanto quanto o gabarito (sinal de possível ambiguidade).</li>
          </ul>
          <p>
            Alertas só aparecem com pelo menos {MIN_ITEM_SAMPLE} respostas por questão; médias e medianas da plataforma, com pelo menos{" "}
            {MIN_PLATFORM_SAMPLE} avaliações concluídas. Mesmo assim, quem usa a plataforma é uma amostra de conveniência, não
            representativa da população: essas estatísticas não são normas. A confiabilidade por consistência interna (KR-20,{" "}
            <Ref id="kuder-1937">Kuder e Richardson, 1937</Ref>; alfa, <Ref id="cronbach-1951">Cronbach, 1951</Ref>) exige formas fixas
            ou um modelo de itens calibrados e ainda não é reportada.
          </p>

          <h2 id="calibracao">8. Caminho para calibração</h2>
          <p>A arquitetura foi preparada para uma futura calibração legítima:</p>
          <ul>
            <li>cada resposta é armazenada com o item, a versão do item, a versão da avaliação, a alternativa e o tempo;</li>
            <li>há um módulo de Teoria de Resposta ao Item (modelos de Rasch e logístico de 2 parâmetros, estimativa de habilidade EAP) (<Ref id="rasch-1960">Rasch, 1960</Ref>; <Ref id="embretson-2000">Embretson e Reise, 2000</Ref>) que <strong>permanece inativo</strong> enquanto os itens não tiverem parâmetros estimados com dados reais e fonte documentada;</li>
            <li>há uma tabela de normas que só é usada se marcada como validada, com amostra de pelo menos {MIN_NORM_SAMPLE.toLocaleString("pt-BR")} pessoas e fidedignidade mínima de 0,80 — critérios mínimos de produto, que não substituem um estudo de padronização completo.</li>
          </ul>
          <p>
            Uma calibração real exigiria amostra planejada e representativa, aplicação padronizada, análise de dimensionalidade,
            estimação de parâmetros, estudos de validade e, para uso profissional no Brasil, submissão ao SATEPSI. A oferta em outros
            idiomas exigiria adaptação — e não apenas tradução — dos itens (<Ref id="itc-2018">ITC, 2018</Ref>).
          </p>

          <h2 id="limitacoes">9. Limitações</h2>
          <ul>
            <li>Aplicação on-line não supervisionada: não é possível controlar ambiente, consultas externas ou anotações.</li>
            <li>Poucas questões por categoria: resultados por categoria são instáveis.</li>
            <li>Efeito de prática: repetir a avaliação tende a melhorar o desempenho sem mudança real de habilidade.</li>
            <li>Dependência de idioma e cultura nos itens verbais.</li>
            <li>Itens figurais respondidos com leitor de tela tornam-se tarefas diferentes.</li>
            <li>Ausência de evidências empíricas de validade, fidedignidade e normas.</li>
          </ul>

          <h2 id="uso">10. Uso apropriado</h2>
          <p>
            Use o Cognis para curiosidade, prática e reflexão sobre estratégias de raciocínio. <strong>Não use</strong> os resultados
            para diagnóstico, decisões médicas, educacionais ou profissionais, seleção de pessoas ou comparação de grupos. Se você
            precisa de uma avaliação cognitiva formal, procure um psicólogo, que utilizará instrumentos aprovados pelo SATEPSI.
          </p>
        </article>
      </div>
    </div>
  );
}
