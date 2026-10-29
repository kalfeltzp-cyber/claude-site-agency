import Link from "next/link";
import { FOOTER_NAV } from "@/lib/site";
import { LogoMark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line/70 no-print">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr]">
        <div className="max-w-md space-y-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-6" />
            <span className="font-display text-xl">Cognis</span>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            Plataforma experimental de avaliação de raciocínio. Os resultados descrevem o desempenho em uma
            avaliação específica e <strong className="text-ink">não</strong> constituem medida clínica de QI, diagnóstico
            ou base para decisões médicas, educacionais ou profissionais.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {FOOTER_NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-muted hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line/50">
        <p className="container py-5 text-xs text-faint">
          © {new Date().getFullYear()} Cognis · Questões originais · Código e metodologia documentados
        </p>
      </div>
    </footer>
  );
}
