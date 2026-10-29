import { formatPct } from "@/lib/i18n";

/** Barra empilhada: corretas / incorretas / não respondidas (cores de status + rótulo). */
export function OutcomeBar({ correct, incorrect, unanswered }: { correct: number; incorrect: number; unanswered: number }) {
  const total = correct + incorrect + unanswered;
  const parts = [
    { key: "c", label: "Corretas", n: correct, cls: "bg-good", icon: "✓" },
    { key: "i", label: "Incorretas", n: incorrect, cls: "bg-bad", icon: "×" },
    { key: "u", label: "Não respondidas", n: unanswered, cls: "bg-faint/50", icon: "–" },
  ];
  return (
    <figure>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img" aria-label={parts.map((p) => `${p.label}: ${p.n} de ${total}`).join("; ")}>
        {parts
          .filter((p) => p.n > 0)
          .map((p) => (
            <div key={p.key} className={`${p.cls} first:rounded-l-full last:rounded-r-full`} style={{ width: `${(100 * p.n) / total}%` }} title={`${p.label}: ${p.n} (${formatPct(Math.round((1000 * p.n) / total) / 10)})`} />
          ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-2 text-muted">
            <span aria-hidden className={`inline-grid size-4 place-items-center rounded-full text-[10px] font-bold text-white ${p.cls}`}>
              {p.icon}
            </span>
            {p.label} <span className="font-mono tabular-nums text-ink">{p.n}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
