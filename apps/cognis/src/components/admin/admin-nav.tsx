import Link from "next/link";
import { cn } from "../ui/cn";

const LINKS = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/questoes", label: "Questões" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/versoes", label: "Versões" },
  { href: "/admin/referencias", label: "Referências" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav aria-label="Administração" className="mt-6 overflow-x-auto">
      <ul className="flex gap-1 border-b border-line">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active === l.href ? "page" : undefined}
              className={cn(
                "-mb-px block whitespace-nowrap border-b-2 px-4 py-2.5 text-sm",
                active === l.href ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminHeader({ title, active, children }: { title: string; active: string; children?: React.ReactNode }) {
  return (
    <header className="pt-10">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-violet">Painel administrativo</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl">{title}</h1>
        {children}
      </div>
      <AdminNav active={active} />
    </header>
  );
}
