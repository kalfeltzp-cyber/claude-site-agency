/** Estatística descritiva simples, sem dependências. */

export function mean(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Desvio-padrão amostral (n − 1). */
export function sd(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

/** Histograma de largura fixa em [min, max]; o último intervalo é fechado. */
export function histogram(xs: readonly number[], min: number, max: number, bins: number): HistogramBin[] {
  const width = (max - min) / bins;
  const out: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const x of xs) {
    if (x < min || x > max) continue;
    const idx = Math.min(bins - 1, Math.floor((x - min) / width));
    out[idx].count++;
  }
  return out;
}

/** Correlação de Pearson; null se alguma variância for zero ou n < 3. */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Tamanho mínimo de amostra a partir do qual exibimos médias/medianas da plataforma. */
export const MIN_PLATFORM_SAMPLE = 30;
