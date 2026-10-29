import type { HistogramBin } from "@/lib/stats/descriptive";
import { DataTable } from "./data-table";

/** Histograma de colunas (uma série). */
export function Histogram({ bins, caption, highlight }: { bins: HistogramBin[]; caption: string; highlight?: number }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  // Intervalos semiabertos [de, até), exceto o último, que inclui o limite superior.
  const fmt = (b: HistogramBin, i: number) => `${b.from} a ${i === bins.length - 1 ? b.to : `menos de ${b.to}`}`;
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={caption}>
        {bins.map((b, i) => {
          const hit = highlight !== undefined && highlight >= b.from && (highlight < b.to || (i === bins.length - 1 && highlight <= b.to));
          return (
            <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${fmt(b, i)}: ${b.count}`}>
              {b.count > 0 && <span className="mb-1 text-center font-mono text-[10px] text-muted">{b.count}</span>}
              <div className={`rounded-t-[4px] ${hit ? "bg-violet" : "bg-series"}`} style={{ height: `${(100 * b.count) / max}%`, minHeight: b.count ? 3 : 0 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-faint">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
      {highlight !== undefined && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span className="inline-block size-2.5 rounded-sm bg-violet" aria-hidden /> Faixa do seu resultado
        </p>
      )}
      <DataTable caption={caption} headers={["Faixa do IDC", "Tentativas"]} rows={bins.map((b, i) => [fmt(b, i), b.count])} />
    </figure>
  );
}
