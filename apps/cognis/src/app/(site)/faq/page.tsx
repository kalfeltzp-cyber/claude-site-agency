import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Perguntas frequentes",
  description: "Respostas sobre o resultado, o QI, a duração, a privacidade e o funcionamento da avaliação Cognis.",
  alternates: { canonical: "/faq" },
};
export const dynamic = "force-static";

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "O Cognis mede meu QI?",
    a: (
      <>
        Não. O QI é um escore padronizado que exige normas populacionais e estudos de validação que o Cognis não possui. Mostramos
        um Índice de Desempenho Cognitivo (percentual de acertos nesta avaliação). Veja a <Link href="/metodologia#qi">explicação completa</Link>.
      </>
    ),
  },
  { q: "Quanto tempo leva?", a: "São 36 questões. A maioria das pessoas leva de 25 a 35 minutos; o limite é de 40 minutos." },
  { q: "Preciso criar uma conta?", a: "Não. Sem conta, o resultado fica associado ao seu navegador por 30 dias. Com conta, o histórico fica guardado e você pode acompanhar a evolução." },
  { q: "Posso pausar?", a: "Pode fechar a página e voltar depois, mas o cronômetro continua contando desde o início. Ao fim do prazo, a avaliação é encerrada com as respostas registradas." },
  { q: "Minha conexão caiu. Perdi as respostas?", a: "Não. Cada resposta é enviada ao servidor quando você a escolhe; se a conexão falhar, ela fica guardada no navegador e é reenviada automaticamente." },
  { q: "Por que o item de memória não aparece de novo?", a: "Para que o item avalie memória, o conteúdo é exibido uma única vez, por tempo fixo, controlado pelo servidor. Recarregar a página não o reapresenta." },
  { q: "Fazer de novo melhora o resultado?", a: "Provavelmente sim, por efeito de prática e familiaridade com os formatos — o que não significa aumento real de habilidade. Compare tentativas com cautela." },
  { q: "Os percentuais por categoria são confiáveis?", a: "São instáveis: cada categoria tem 3 ou 4 questões, então uma questão muda o percentual em 25 a 33 pontos. Use-os como pistas para prática, não como perfil." },
  { q: "Posso usar o resultado em um processo seletivo ou laudo?", a: "Não. O Cognis é experimental e não é um teste psicológico aprovado pelo SATEPSI/CFP. Não deve embasar decisões médicas, educacionais ou profissionais." },
  { q: "Quem vê meus resultados?", a: "Somente você. Administradores veem apenas estatísticas agregadas, sem nome ou e-mail. Se você gerar um link de compartilhamento, quem tiver o link vê um resumo anônimo — e você pode desativá-lo." },
  { q: "Como excluo meus dados?", a: <>No seu <Link href="/perfil">perfil</Link>, use “Excluir conta e dados”. Tudo é apagado definitivamente. Você também pode baixar uma cópia antes.</> },
  { q: "As questões foram copiadas de testes conhecidos?", a: "Não. Todas são originais. Algumas seguem paradigmas clássicos da psicologia (matrizes, rotação mental, span de dígitos), que são métodos científicos públicos, mas os itens foram escritos para o Cognis." },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.filter((f) => typeof f.a === "string").map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Perguntas frequentes" title="Dúvidas comuns" />
      <div className="mt-10 max-w-3xl divide-y divide-line/70 border-y border-line/70">
        {FAQ.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium text-ink">
              {f.q}
              <span aria-hidden className="text-accent transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="prose-cognis mt-3 max-w-none"><p>{f.a}</p></div>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
