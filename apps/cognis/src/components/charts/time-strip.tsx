import { formatDuration } from "@/lib/i18n";
import { DataTable } from "./data-table";

export interface TimeItem {
  position: number;
  timeSpentMs: number;
  isCorrect: boolean | null;
  category: string;
}

/** Tempo por questão (colunas), cor = resultado do item, com legenda e ícones. */
export function TimeStrip({ items }: { items: TimeItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.timeSpentMs));
  const cls = (c: boolean | null) => (c === true ? "bg-good" : c === false ? "bg-bad" : "bg-faint/50");
  const word = (c: boolean | null) => (c === true ? "correta" : c === false ? "incorreta" : "não respondida");
  return (
    <figure>
      <div className="flex h-32 items-end gap-[2px]" role="img" aria-label="Tempo gasto em cada questão, na ordem de apresentação">
        {items.map((i) => (
          <div key={i.position} className="flex h-full flex-1 items-end" title={`Questão ${i.position + 1} (${i.category}): ${formatDuration(i.timeSpentMs)} — ${word(i.isCorrect)}`}>
            <div className={`w-full rounded-t-[3px] ${cls(i.isCorrect)}`} style={{ height: `${(100 * i.timeSpentMs) / max}%`, minHeight: 2 }} />
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-good" aria-hidden />✓ Correta</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-bad" aria-hidden />× Incorreta</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-faint/50" aria-hidden />– Não respondida</span>
        <span className="ml-auto font-mono">Maior tempo: {formatDuration(max)}</span>
      </figcaption>
      <DataTable
        caption="Tempo por questão"
        headers={["Questão", "Categoria", "Tempo", "Resultado"]}
        rows={items.map((i) => [i.position + 1, i.category, formatDuration(i.timeSpentMs), word(i.isCorrect)])}
      />
    </figure>
  );
}
