import type { Metadata } from "next";
import { loadReferences } from "@/lib/questions/bank";
import { Notice, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Referências científicas",
  description: "Fontes científicas, normativas e legais em que se apoia a metodologia do Cognis, com DOI e links verificáveis.",
  alternates: { canonical: "/referencias" },
};
export const dynamic = "force-static";

export default function ReferencesPage() {
  const refs = loadReferences();
  const topics = [...new Set(refs.map((r) => r.topic))];
  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Referências" title="Fontes utilizadas">
        Cada referência indica como foi usada no Cognis. Incluímos DOI quando disponível; para normas e diretrizes, o link aponta
        para a organização responsável.
      </PageHeader>
      <Notice className="mt-8 max-w-3xl">
        Citar uma fonte não significa que ela endossa o Cognis. As referências fundamentam decisões de método e, principalmente, as
        limitações declaradas.
      </Notice>
      <div className="mt-10 space-y-12">
        {topics.map((topic) => (
          <section key={topic} aria-labelledby={`t-${topic}`}>
            <h2 id={`t-${topic}`} className="font-display text-2xl">{topic}</h2>
            <ul className="mt-4 divide-y divide-line/70 border-y border-line/70">
              {refs
                .filter((r) => r.topic === topic)
                .map((r) => (
                  <li key={r.id} id={r.id} className="scroll-mt-24 py-5">
                    <p className="leading-relaxed text-ink">
                      {r.authors} ({r.year}). <em>{r.title}</em>. {r.source}.
                    </p>
                    <p className="mt-1.5 text-sm">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline underline-offset-2">
                        {r.doi ? `doi:${r.doi}` : r.url}
                      </a>
                    </p>
                    <p className="mt-2 text-sm text-muted"><span className="text-faint">Uso no Cognis: </span>{r.usedFor}</p>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
