"use client";

import { useId } from "react";
import type { Glyph } from "@/lib/questions/schema";
import { describeGlyph } from "@/lib/questions/describe";
import { cn } from "../ui/cn";

/** Formas desenhadas em coordenadas unitárias centradas em (0, 0). */
function regular(n: number, r: number, offset = -Math.PI / 2) {
  return Array.from({ length: n }, (_, i) => {
    const a = offset + (2 * Math.PI * i) / n;
    return `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`;
  }).join(" ");
}

function star(r1: number, r2: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? r2 : r1;
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    return `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`;
  }).join(" ");
}

const POLYGONS: Record<Exclude<Glyph["shape"], "circle" | "square">, string> = {
  triangle: "0,-0.85 0.85,0.65 -0.85,0.65",
  diamond: "0,-0.9 0.9,0 0,0.9 -0.9,0",
  pentagon: regular(5, 0.88),
  hexagon: regular(6, 0.88),
  star: star(0.95, 0.42),
  arrow: "0,-0.9 0.62,-0.18 0.22,-0.18 0.22,0.88 -0.22,0.88 -0.22,-0.18 -0.62,-0.18",
  fshape: "-0.55,-0.85 0.6,-0.85 0.6,-0.5 -0.2,-0.5 -0.2,-0.15 0.35,-0.15 0.35,0.15 -0.2,0.15 -0.2,0.85 -0.55,0.85",
};

/** Posições (em uma caixa −1..1) para 1 a 9 cópias. */
function layout(count: number): { x: number; y: number; s: number }[] {
  const grid = (cols: number, rows: number, s: number, n: number) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const rowCount = Math.min(cols, n - r * cols);
      const xOffset = ((cols - rowCount) * (2 / cols)) / 2;
      pts.push({ x: -1 + (2 / cols) * (c + 0.5) + xOffset, y: -1 + (2 / rows) * (r + 0.5), s });
    }
    return pts;
  };
  switch (count) {
    case 1:
      return [{ x: 0, y: 0, s: 0.62 }];
    case 2:
      return [{ x: -0.48, y: 0, s: 0.4 }, { x: 0.48, y: 0, s: 0.4 }];
    case 3:
      return [{ x: 0, y: -0.45, s: 0.36 }, { x: -0.48, y: 0.42, s: 0.36 }, { x: 0.48, y: 0.42, s: 0.36 }];
    case 4:
      return grid(2, 2, 0.36, 4);
    case 5:
      return [...grid(2, 2, 0.3, 4).map((p) => ({ ...p, x: p.x * 1.1, y: p.y * 1.1 })), { x: 0, y: 0, s: 0.3 }];
    case 6:
      return grid(3, 2, 0.28, 6);
    default:
      return grid(3, 3, 0.26, count);
  }
}

export function GlyphCell({ glyph, className, decorative = false }: { glyph: Glyph; className?: string; decorative?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const patternId = `hatch-${uid}`;
  const fill = glyph.fill === "solid" ? "currentColor" : glyph.fill === "striped" ? `url(#${patternId})` : "none";
  const transform = (x: number, y: number, s: number) => `translate(${x} ${y}) scale(${s}) rotate(${glyph.rotation}) scale(${glyph.mirror ? -1 : 1} 1)`;

  return (
    <svg
      viewBox="-1.1 -1.1 2.2 2.2"
      className={cn("text-ink", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : describeGlyph(glyph)}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      {glyph.fill === "striped" && (
        <defs>
          <pattern id={patternId} width="0.16" height="0.16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="0.16" stroke="currentColor" strokeWidth="0.06" />
          </pattern>
        </defs>
      )}
      {layout(glyph.count).map((p, i) => (
        <g key={i} transform={transform(p.x, p.y, p.s)}>
          {glyph.shape === "circle" ? (
            <circle r="0.85" fill={fill} stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          ) : glyph.shape === "square" ? (
            <rect x="-0.75" y="-0.75" width="1.5" height="1.5" fill={fill} stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          ) : (
            <polygon points={POLYGONS[glyph.shape]} fill={fill} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
        </g>
      ))}
    </svg>
  );
}

function MissingCell({ label = "Célula ausente" }: { label?: string }) {
  return (
    <div className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-accent/60 bg-accent/[0.06]" role="img" aria-label={label}>
      <span className="font-display text-4xl text-accent" aria-hidden>
        ?
      </span>
    </div>
  );
}

export function FigureMatrix({ cells }: { cells: (Glyph | null)[] }) {
  return (
    <div role="group" aria-label="Matriz de figuras 3 por 3, lida da esquerda para a direita e de cima para baixo" className="mx-auto grid w-full max-w-[360px] grid-cols-3 gap-2 rounded-2xl border border-line bg-surface-2/60 p-2">
      {cells.map((c, i) =>
        c ? (
          <div key={i} className="aspect-square rounded-xl border border-line bg-surface p-2">
            <GlyphCell glyph={c} className="size-full" />
          </div>
        ) : (
          <MissingCell key={i} />
        ),
      )}
    </div>
  );
}

export function FigureSequence({ items }: { items: Glyph[] }) {
  return (
    <ol aria-label="Sequência de figuras" className="mx-auto grid w-full max-w-[560px] gap-2" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
      {items.map((g, i) => (
        <li key={i} className="aspect-square rounded-xl border border-line bg-surface p-1.5">
          <GlyphCell glyph={g} className="size-full" />
        </li>
      ))}
      <li>
        <MissingCell label="Próxima figura" />
      </li>
    </ol>
  );
}

export function FigureModel({ glyph }: { glyph: Glyph }) {
  return (
    <figure className="mx-auto w-40">
      <div className="aspect-square rounded-2xl border border-line bg-surface p-3">
        <GlyphCell glyph={glyph} className="size-full" />
      </div>
      <figcaption className="mt-2 text-center text-xs uppercase tracking-wider text-faint">Figura-modelo</figcaption>
    </figure>
  );
}

export function QuestionFigure({ figure }: { figure: { matrix?: (Glyph | null)[]; sequence?: Glyph[]; model?: Glyph } | null }) {
  if (!figure) return null;
  if (figure.matrix) return <FigureMatrix cells={figure.matrix} />;
  if (figure.sequence) return <FigureSequence items={figure.sequence} />;
  if (figure.model) return <FigureModel glyph={figure.model} />;
  return null;
}
