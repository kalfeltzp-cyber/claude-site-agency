import type { Diagnosis } from "@/lib/diagnostics";
import { cn } from "../ui/cn";

export function DiagnosisList({ diagnosis }: { diagnosis: Diagnosis }) {
  const icon = { ok: "✓", erro: "×", aviso: "!" } as const;
  const tone = { ok: "text-good border-good/50", erro: "text-bad border-bad/50", aviso: "text-warn border-warn/50" } as const;
  const word = { ok: "OK", erro: "Erro", aviso: "Atenção" } as const;
  return (
    <ul className="divide-y divide-line/70 rounded-2xl border border-line bg-surface">
      {diagnosis.checks.map((c) => (
        <li key={c.id} className="flex gap-4 p-4">
          <span aria-hidden className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold", tone[c.status])}>
            {icon[c.status]}
          </span>
          <div>
            <p className="font-medium text-ink">
              {c.label} <span className={cn("ml-1 text-xs", tone[c.status].split(" ")[0])}>({word[c.status]})</span>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
