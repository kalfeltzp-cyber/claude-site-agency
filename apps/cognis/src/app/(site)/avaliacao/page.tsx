import type { Metadata } from "next";
import Link from "next/link";
import { getOwner } from "@/lib/auth/session";
import { findActiveAttempt } from "@/lib/services/assessment";
import { getActiveTestVersion } from "@/lib/services/content-repo";
import { blueprintSize } from "@/lib/engine/selection";
import { db } from "@/lib/db/pool";
import { StartPanel } from "@/components/assessment/start-panel";
import { Card, Notice } from "@/components/ui/card";
import { diagnose } from "@/lib/diagnostics";
import { DiagnosisList } from "@/components/setup/diagnosis-list";

export const metadata: Metadata = {
  title: "Iniciar avaliação",
  description: "Inicie a avaliação experimental de raciocínio do Cognis: 36 questões, cerca de 25 a 35 minutos, sem cadastro obrigatório.",
  alternates: { canonical: "/avaliacao" },
};
export const dynamic = "force-dynamic";

export default async function StartPage() {
  const owner = await getOwner();
  let active: string | null;
  let version: Awaited<ReturnType<typeof getActiveTestVersion>>;
  try {
    [active, version] = await Promise.all([findActiveAttempt(owner), getActiveTestVersion(db)]);
  } catch (err) {
    // Em vez de uma página de erro genérica, mostra o que falta configurar.
    console.error("[avaliacao] falha ao acessar o banco:", (err as Error).message);
    const diagnosis = await diagnose();
    return (
      <div className="container max-w-3xl space-y-6 py-12 sm:py-16">
        <h1 className="font-display text-4xl sm:text-5xl">Avaliação indisponível no momento</h1>
        <Notice tone="bad" title="O site não conseguiu acessar o banco de dados">
          Se você é o responsável pelo site, veja abaixo o que corrigir. Depois de alterar variáveis na Vercel, faça Redeploy.
        </Notice>
        <DiagnosisList diagnosis={diagnosis} />
        <p className="text-sm text-muted">Diagnóstico completo em <Link href="/status" className="text-accent underline">/status</Link>.</p>
      </div>
    );
  }
  const size = version ? blueprintSize(version.blueprint) : null;
  const minutes = version ? Math.round(version.timeLimitSeconds / 60) : null;

  return (
    <div className="container grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.2fr_1fr]">
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Avaliação padrão</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Antes de começar</h1>
        <ul className="mt-8 space-y-4 text-muted">
          {[
            ["Duração", `${size ?? "—"} questões. A maioria das pessoas leva de 25 a 35 minutos; o limite é de ${minutes ?? "—"} minutos.`],
            ["Ambiente", "Escolha um lugar silencioso, sem interrupções. Use papel apenas se quiser, mas não para os itens de memória."],
            ["Navegação", "Você pode voltar, pular e mudar respostas até encerrar. Cada resposta é salva no servidor automaticamente."],
            ["Memória", "Itens de memória mostram um conteúdo por poucos segundos, uma única vez, antes da pergunta."],
            ["Interrupções", "Se a conexão cair ou a página fechar, retome depois: o cronômetro continua contando desde o início."],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-4">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <strong className="text-ink">{t}.</strong> {d}
              </span>
            </li>
          ))}
        </ul>
        <Notice className="mt-8" tone="warn" title="Resultado experimental">
          O Cognis calcula um <strong>Índice de Desempenho Cognitivo</strong> (percentual de acertos). Ele não é um QI, não usa normas
          populacionais e não serve para decisões clínicas, educacionais ou profissionais.{" "}
          <Link href="/metodologia" className="text-accent underline underline-offset-2">Entenda a metodologia</Link>.
        </Notice>
      </section>
      <Card className="h-fit p-6 sm:p-8">
        <h2 className="font-display text-2xl">{active ? "Avaliação em andamento" : "Pronto para começar?"}</h2>
        <div className="mt-5">
          {version ? (
            <StartPanel activeAttemptId={active} />
          ) : (
            <Notice tone="bad" title="Avaliação indisponível">Nenhuma versão da avaliação está ativa no momento.</Notice>
          )}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-faint">
          Sem conta, o resultado fica associado a este navegador por 30 dias. <Link href="/entrar" className="underline">Crie uma conta</Link> para guardar o histórico.
        </p>
      </Card>
    </div>
  );
}
