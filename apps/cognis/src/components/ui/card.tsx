import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...props} />;
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "bad" | "warn" | "violet"; className?: string }) {
  const tones = {
    neutral: "border-line text-muted",
    accent: "border-accent/40 text-accent",
    violet: "border-violet/40 text-violet",
    good: "border-good/40 text-good",
    bad: "border-bad/40 text-bad",
    warn: "border-warn/40 text-warn",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Notice({
  title,
  children,
  tone = "info",
  className,
}: {
  title?: string;
  children: ReactNode;
  tone?: "info" | "warn" | "bad" | "good";
  className?: string;
}) {
  const tones = {
    info: "border-accent/30 bg-accent/[0.06]",
    warn: "border-warn/40 bg-warn/[0.07]",
    bad: "border-bad/40 bg-bad/[0.07]",
    good: "border-good/40 bg-good/[0.07]",
  };
  const icons = { info: "i", warn: "!", bad: "×", good: "✓" };
  const iconTone = { info: "text-accent border-accent/50", warn: "text-warn border-warn/50", bad: "text-bad border-bad/50", good: "text-good border-good/50" };
  return (
    <div role={tone === "bad" ? "alert" : "note"} className={cn("flex gap-3 rounded-xl border p-4 text-sm", tones[tone], className)}>
      <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-bold", iconTone[tone])}>
        {icons[tone]}
      </span>
      <div className="space-y-1 text-muted">
        {title && <p className="font-semibold text-ink">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="border-b border-line/70 pb-8 pt-12 sm:pt-16">
      {eyebrow && <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
      <h1 className="max-w-3xl font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">{title}</h1>
      {children && <div className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{children}</div>}
    </header>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-10 text-center">
      <p className="font-display text-2xl">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
