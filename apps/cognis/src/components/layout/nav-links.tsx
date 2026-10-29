"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/site";
import { cn } from "../ui/cn";

export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-1 md:flex">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("rounded-lg px-3 py-2 text-sm transition-colors", active ? "text-ink" : "text-muted hover:text-ink")}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
