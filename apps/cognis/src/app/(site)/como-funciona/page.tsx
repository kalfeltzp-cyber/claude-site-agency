import type { Metadata } from "next";
import Link from "next/link";
import { loadCategories, loadTestVersions } from "@/lib/questions/bank";
import { blueprintSize } from "@/lib/engine/selection";
import { DIFFICULTY_LABEL } from "@/lib/engine/types";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { FigureSequence, GlyphCell } from "@/components/figures/figure";

export const metadata: Metadata = {
  title: "Como funciona a avaliação",
  description: "Estrutura, duração, regras, tipos de questão e significado do resultado da avaliação experimental Cognis.",
  alternates: { canonical: "/como-funciona" },
};
export const dynamic = "force-static";

export default function HowItWorksPage() {
  const categories = loadCategories();
  const version = loadTestVersions().find((v) => v.status === "active")!;
  const size = blueprintSize(version.blueprint);
  const minutes = Math.round(version.timeLimitSeconds / 60);

  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Explicação do teste" title="Como funciona a avaliação">
        Uma avaliação de {size} questões de múltipla escolha, com limite de {minutes} minutos, que gera um relatório detalhado do seu
        desempenho.
      </PageHeader>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
        <div className="prose-cognis max-w-none">
          <h2>Estrutura</h2>
          <p>
            Cada avaliação sorteia itens de um banco de questões originais segundo uma <strong>matriz fixa</strong>: cada categoria
            recebe um número definido de questões fáceis, médias e difíceis. Assim, duas pessoas recebem provas diferentes, mas
            equivalentes em composição. As questões aparecem da mais fácil para a mais difícil, alternando categorias.
          </p>
          <h2>Regras</h2>
          <ul>
            <li>Você pode avançar, voltar, pular e alterar respostas até encerrar a avaliação.</li>
            <li>Cada resposta é enviada ao servidor no momento em que você a escolhe. Se a conexão cair, ela é reenviada automaticamente.</li>
            <li>O cronômetro começa ao iniciar e não para: fechar a página não pausa o tempo. Ao fim do prazo, a avaliação é encerrada com as respostas já registradas.</li>
            <li>Questões sem resposta contam como não respondidas (não há penalidade extra por erro).</li>
            <li>Os gabaritos não são enviados ao navegador durante a avaliação.</li>
          </ul>
          <h2>Tipos de questão</h2>
          <ul>
            <li><strong>Texto</strong>: enunciado e alternativas escritas (lógica, dedução, números, analogias, problemas).</li>
            <li><strong>Matrizes</strong>: uma grade 3 × 3 de figuras com uma célula vazia.</li>
            <li><strong>Sequências figurais</strong>: descubra a próxima figura.</li>
            <li><strong>Rotação e reflexão</strong>: identifique a transformação aplicada a uma figura-modelo.</li>
            <li><strong>Memória de trabalho</strong>: um conteúdo aparece por poucos segundos, uma única vez; depois vem a pergunta.</li>
          </ul>
          <h2>Acessibilidade</h2>
          <p>
            A avaliação pode ser feita apenas com o teclado (Tab para navegar, setas ou as teclas A–F e 1–6 para escolher) e é
            compatível com leitores de tela: as figuras têm descrição textual. Como a descrição textual muda a natureza dos itens
            visuais, resultados das categorias figurais obtidos com leitor de tela não são comparáveis aos obtidos visualmente.
          </p>
          <h2>O resultado</h2>
          <p>
            Ao final, você vê o <strong>Índice de Desempenho Cognitivo (IDC)</strong> — percentual de acertos —, os acertos por
            categoria e por dificuldade, o tempo por questão, pontos fortes, categorias com menor desempenho e sugestões de prática. O
            relatório completo inclui o gabarito comentado de cada questão. Veja os detalhes na{" "}
            <Link href="/metodologia">metodologia</Link>.
          </p>
        </div>

        <aside className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-2xl">Composição da avaliação</h2>
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">Itens por categoria e dificuldade</caption>
              <thead>
                <tr className="text-left text-faint">
                  <th scope="col" className="pb-2 font-medium">Categoria</th>
                  {[1, 2, 3].map((d) => (
                    <th key={d} scope="col" className="pb-2 text-center font-medium">{DIFFICULTY_LABEL[d as 1 | 2 | 3]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {version.blueprint.cells.map((c) => (
                  <tr key={c.category} className="border-t border-line/60">
                    <td className="py-2 text-ink">{categories.find((x) => x.id === c.category)?.name ?? c.category}</td>
                    {(["1", "2", "3"] as const).map((d) => (
                      <td key={d} className="py-2 text-center font-mono text-muted">{c.counts[d]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-faint">Parâmetros de produto definidos pelos autores, não padrões científicos.</p>
          </Card>
          <Card className="p-6">
            <h2 className="font-display text-2xl">Exemplo de sequência</h2>
            <p className="mb-4 mt-2 text-sm text-muted">A seta gira 90° no sentido horário a cada passo. Qual vem depois?</p>
            <FigureSequence
              items={[0, 90, 180].map((rotation) => ({ shape: "arrow" as const, fill: "solid" as const, rotation, mirror: false, count: 1 }))}
            />
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-accent">Ver resposta</summary>
              <div className="mt-3 flex items-center gap-3 text-muted">
                <GlyphCell glyph={{ shape: "arrow", fill: "solid", rotation: 270, mirror: false, count: 1 }} className="size-12" />
                A seta apontando para a esquerda (270°).
              </div>
            </details>
          </Card>
          <ButtonLink href="/avaliacao" size="lg" className="w-full">Começar avaliação</ButtonLink>
        </aside>
      </div>
    </div>
  );
}
