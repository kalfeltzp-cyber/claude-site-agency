import type { ReactNode } from "react";

/** Visão em tabela dos dados de um gráfico (acessibilidade e conferência). */
export function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    <details className="mt-3 text-sm no-print">
      <summary className="cursor-pointer text-muted hover:text-ink">Ver dados em tabela</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col" className="border-b border-line py-1.5 pr-4 font-medium text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="border-b border-line/50 py-1.5 pr-4 tabular-nums">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
