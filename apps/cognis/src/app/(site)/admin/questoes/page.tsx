import type { Metadata } from "next";
import Link from "next/link";
import { adminGuard } from "@/lib/auth/guard";
import { db } from "@/lib/db/pool";
import { listCategories, listQuestions } from "@/lib/services/content-repo";
import { itemAnalysis } from "@/lib/services/admin-stats";
import { FLAG_LABEL } from "@/lib/stats/items";
import { formatNum, t } from "@/lib/i18n";
import { AdminHeader } from "@/components/admin/admin-nav";
import { ToggleActive } from "@/components/admin/toggle-active";
import { Badge, Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Admin · Questões", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminQuestionsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  await adminGuard("/admin/questoes");
  const { categoria } = await searchParams;
  const [questions, categories, analysis] = await Promise.all([listQuestions(db), listCategories(db, true), itemAnalysis()]);
  const stats = new Map(analysis.map((a) => [a.questionId, a]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const shown = categoria ? questions.filter((q) => q.category === categoria) : questions;
  const active = questions.filter((q) => q.active && q.status === "reviewed").length;

  return (
    <div className="container pb-16">
      <AdminHeader title="Banco de questões" active="/admin/questoes">
        <ButtonLink href="/admin/questoes/nova" size="sm">Nova questão</ButtonLink>
      </AdminHeader>
      <p className="mt-6 text-sm text-muted">
        {questions.length} questões cadastradas · {active} ativas e revisadas (elegíveis para sorteio). Indicadores de qualidade
        calculados a partir das avaliações concluídas; alertas exigem amostra mínima.
      </p>
      <nav aria-label="Filtrar por categoria" className="mt-4 flex flex-wrap gap-2">
        <Link href="/admin/questoes" className={`rounded-full border px-3 py-1 text-sm ${!categoria ? "border-accent text-ink" : "border-line text-muted"}`}>Todas</Link>
        {categories.map((c) => (
          <Link key={c.id} href={`/admin/questoes?categoria=${c.id}`} className={`rounded-full border px-3 py-1 text-sm ${categoria === c.id ? "border-accent text-ink" : "border-line text-muted"}`}>
            {c.name}
          </Link>
        ))}
      </nav>
      <Card className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">Questões e indicadores de qualidade</caption>
            <thead className="bg-surface-2 text-muted">
              <tr>
                {["Id", "Categoria", "Nível", "Formato", "Estado", "n", "p", "r it", "Alertas", "Ativa", ""].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((q) => {
                const s = stats.get(q.id);
                return (
                  <tr key={q.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono">{q.id}<span className="ml-1 text-faint">v{q.version}</span></td>
                    <td className="px-4 py-3">{catName.get(q.category) ?? q.category}</td>
                    <td className="px-4 py-3">{t.difficulty[q.difficulty]}</td>
                    <td className="px-4 py-3 text-muted">{q.format}</td>
                    <td className="px-4 py-3"><Badge tone={q.status === "reviewed" ? "good" : q.status === "draft" ? "warn" : "neutral"}>{q.status}</Badge></td>
                    <td className="px-4 py-3 font-mono">{s?.n ?? 0}</td>
                    <td className="px-4 py-3 font-mono">{s?.p == null ? "—" : formatNum(s.p, 2)}</td>
                    <td className="px-4 py-3 font-mono">{s?.discrimination == null ? "—" : formatNum(s.discrimination, 2)}</td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        {(s?.flags ?? ["amostra_insuficiente"]).map((f) => (
                          <li key={f}><Badge tone={f === "amostra_insuficiente" ? "neutral" : "warn"}>{FLAG_LABEL[f]}</Badge></li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3"><ToggleActive id={q.id} active={q.active} /></td>
                    <td className="px-4 py-3"><Link href={`/admin/questoes/${q.id}`} className="text-accent hover:underline">Editar</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
