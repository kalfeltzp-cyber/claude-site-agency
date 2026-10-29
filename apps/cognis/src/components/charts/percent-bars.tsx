import { formatPct } from "@/lib/i18n";
import { DataTable } from "./data-table";

export interface PercentRow {
  key: string;
  label: string;
  percent: number | null;
  detail: string;
}

/** Barras horizontais 0–100% de uma única série, com rótulo direto e linha de referência opcional. */
export function PercentBars({ rows, caption, reference }: { rows: PercentRow[]; caption: string; reference?: { value: number; label: string } }) {
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
            <span className="truncate text-sm text-ink" title={r.label}>
              {r.label}
            </span>
            <div className="relative h-2.5 rounded-full bg-surface-2" title={`${r.label}: ${r.percent === null ? "sem dados" : formatPct(r.percent)} (${r.detail})`}>
              {r.percent !== null && r.percent > 0 && (
                <div className="absolute inset-y-0 left-0 rounded-full bg-series" style={{ width: `${Math.max(1.5, r.percent)}%` }} />
              )}
              {reference && (
                <div className="absolute -inset-y-1 w-px bg-ink/60" style={{ left: `${reference.value}%` }} aria-hidden />
              )}
            </div>
            <span className="w-24 text-right font-mono text-sm tabular-nums text-ink">
              {r.percent === null ? "—" : formatPct(r.percent)} <span className="text-faint">· {r.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {reference && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span className="inline-block h-3 w-px bg-ink/60" aria-hidden /> {reference.label}
        </p>
      )}
      <DataTable caption={caption} headers={["Item", "Percentual", "Detalhe"]} rows={rows.map((r) => [r.label, r.percent === null ? "—" : formatPct(r.percent), r.detail])} />
    </figure>
  );
}
