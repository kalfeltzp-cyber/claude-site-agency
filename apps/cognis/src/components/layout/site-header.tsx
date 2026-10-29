import Link from "next/link";
import { LogoMark } from "./logo";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { UserNav } from "./user-nav";
import { buttonClass } from "../ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md no-print">
      <div className="container relative flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Cognis — página inicial">
          <LogoMark />
          <span className="font-display text-[22px] leading-none tracking-tight">Cognis</span>
        </Link>
        <nav aria-label="Principal" className="flex-1">
          <NavLinks />
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/avaliacao" className={buttonClass("primary", "sm", "ml-1 hidden sm:inline-flex")}>
            Começar
          </Link>
          <UserNav />
        </div>
      </div>
    </header>
  );
}
