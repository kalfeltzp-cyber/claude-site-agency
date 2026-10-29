"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/site";

export function MobileNav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Menu principal" className="absolute inset-x-0 top-16 z-40 border-b border-line bg-bg/95 px-4 pb-6 pt-2 backdrop-blur animate-fade-up">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-lg px-3 py-3 text-ink hover:bg-surface-2" aria-current={pathname === item.href ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={signedIn ? "/perfil" : "/entrar"} className="block rounded-lg px-3 py-3 text-ink hover:bg-surface-2">
                {signedIn ? "Meu perfil" : "Entrar ou criar conta"}
              </Link>
            </li>
            {isAdmin && (
              <li>
                <Link href="/admin" className="block rounded-lg px-3 py-3 text-ink hover:bg-surface-2">
                  Painel administrativo
                </Link>
              </li>
            )}
          </ul>
          <Link href="/avaliacao" className="mt-4 flex h-11 items-center justify-center rounded-xl bg-accent font-medium text-accent-ink">
            Começar avaliação
          </Link>
        </nav>
      )}
    </div>
  );
}
