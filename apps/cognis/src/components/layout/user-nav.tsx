"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MobileNav } from "./mobile-nav";

interface Me {
  signedIn: boolean;
  displayName: string | null;
  isAdmin: boolean;
}

/** Parte do cabeçalho que depende da sessão; carregada no cliente para manter páginas públicas estáticas. */
export function UserNav() {
  const [me, setMe] = useState<Me | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setMe(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <>
      {me?.isAdmin && (
        <Link href="/admin" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-ink md:block">
          Admin
        </Link>
      )}
      <Link href={me?.signedIn ? "/perfil" : "/entrar"} className="hidden max-w-[10rem] truncate rounded-lg px-3 py-2 text-sm text-muted hover:text-ink md:block">
        {me?.signedIn ? (me.displayName ?? "Perfil") : "Entrar"}
      </Link>
      <MobileNav signedIn={Boolean(me?.signedIn)} isAdmin={Boolean(me?.isAdmin)} />
    </>
  );
}

