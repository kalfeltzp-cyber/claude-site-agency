import { formatDateShort, formatPct } from "@/lib/i18n";
import { DataTable } from "./data-table";

/** Evolução do IDC entre tentativas concluídas (linha única, escala fixa 0–100). */
export function HistoryChart({ points }: { points: { date: string; value: number; label: string }[] }) {
  const W = 640;
  const H = 220;
  const pad = { l: 36, r: 16, t: 14, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length === 1 ? iw / 2 : (iw * i) / (points.length - 1));
  const y = (v: number) => pad.t + ih - (ih * v) / 100;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const step = Math.max(1, Math.ceil(points.length / 6));

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Evolução do índice em ${points.length} tentativas`}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--faint))">
              {t}
            </text>
          </g>
        ))}
        {points.length > 1 && <path d={path} fill="none" stroke="rgb(var(--series))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="5" fill="rgb(var(--series))" stroke="rgb(var(--surface))" strokeWidth="2">
              <title>{`${p.label} — ${formatPct(p.value)}`}</title>
            </circle>
            {(i % step === 0 || i === points.length - 1) && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="rgb(var(--faint))">
                {formatDateShort(p.date)}
              </text>
            )}
          </g>
        ))}
        {points.length > 0 && (
          <text x={x(points.length - 1)} y={y(points.at(-1)!.value) - 12} textAnchor="middle" fontSize="12" fontWeight="600" fill="rgb(var(--ink))">
            {formatPct(points.at(-1)!.value)}
          </text>
        )}
      </svg>
      <DataTable caption="Histórico do índice" headers={["Tentativa", "Data", "IDC"]} rows={points.map((p) => [p.label, formatDateShort(p.date), formatPct(p.value)])} />
    </figure>
  );
}
