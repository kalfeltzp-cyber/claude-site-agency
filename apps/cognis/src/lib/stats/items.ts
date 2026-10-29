import { mean, pearson } from "./descriptive";

/**
 * Análise de itens pela teoria clássica dos testes.
 *  - p (índice de dificuldade) = proporção de acertos entre quem viu o item.
 *  - r_it corrigido = correlação ponto-bisserial entre acertar o item e a
 *    proporção de acertos no RESTANTE da prova (excluindo o próprio item),
 *    o que funciona mesmo com formas sorteadas de tamanhos iguais.
 *  - Frequência de cada alternativa e alerta para distratores "atraentes"
 *    entre os participantes de melhor desempenho.
 * Alertas só são emitidos com n ≥ MIN_ITEM_SAMPLE.
 */

export const MIN_ITEM_SAMPLE = 30;

export interface ItemObservation {
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
}

export interface AttemptTotals {
  attemptId: string;
  correct: number;
  total: number;
}

export type ItemFlag =
  | "amostra_insuficiente"
  | "muito_facil"
  | "muito_dificil"
  | "discriminacao_baixa"
  | "discriminacao_negativa"
  | "distrator_atraente";

export interface ItemAnalysis {
  questionId: string;
  n: number;
  p: number | null;
  discrimination: number | null;
  omitRate: number | null;
  optionCounts: Record<string, number>;
  flags: ItemFlag[];
}

export function analyzeItems(
  observations: readonly ItemObservation[],
  totals: readonly AttemptTotals[],
  answerKey: Record<string, string>,
): ItemAnalysis[] {
  const totalsById = new Map(totals.map((t) => [t.attemptId, t]));
  const byItem = new Map<string, ItemObservation[]>();
  for (const o of observations) {
    if (!byItem.has(o.questionId)) byItem.set(o.questionId, []);
    byItem.get(o.questionId)!.push(o);
  }

  const result: ItemAnalysis[] = [];
  for (const [questionId, obs] of byItem) {
    const n = obs.length;
    const scores = obs.map((o) => (o.isCorrect ? 1 : 0));
    const rest = obs.map((o) => {
      const t = totalsById.get(o.attemptId);
      if (!t || t.total <= 1) return 0;
      return (t.correct - (o.isCorrect ? 1 : 0)) / (t.total - 1);
    });
    const optionCounts: Record<string, number> = {};
    for (const o of obs) {
      const key = o.selectedOptionId ?? "_omitida";
      optionCounts[key] = (optionCounts[key] ?? 0) + 1;
    }
    const p = n ? mean(scores) : null;
    const discrimination = pearson(scores, rest);
    const omitRate = n ? obs.filter((o) => o.selectedOptionId === null).length / n : null;

    const flags: ItemFlag[] = [];
    if (n < MIN_ITEM_SAMPLE) {
      flags.push("amostra_insuficiente");
    } else {
      if (p !== null && p > 0.9) flags.push("muito_facil");
      if (p !== null && p < 0.2) flags.push("muito_dificil");
      if (discrimination !== null && discrimination < 0) flags.push("discriminacao_negativa");
      else if (discrimination !== null && discrimination < 0.15) flags.push("discriminacao_baixa");
      if (hasAttractiveDistractor(obs, rest, answerKey[questionId])) flags.push("distrator_atraente");
    }
    result.push({ questionId, n, p, discrimination, omitRate, optionCounts, flags });
  }
  return result.sort((a, b) => a.questionId.localeCompare(b.questionId));
}

/**
 * Um distrator é "atraente" (possível ambiguidade ou gabarito discutível)
 * quando, no terço superior de desempenho no restante da prova, ele é
 * escolhido pelo menos tanto quanto o gabarito.
 */
function hasAttractiveDistractor(obs: ItemObservation[], rest: number[], key: string | undefined): boolean {
  if (!key) return false;
  const ranked = obs.map((o, i) => ({ o, r: rest[i] })).sort((a, b) => b.r - a.r);
  const top = ranked.slice(0, Math.max(1, Math.floor(ranked.length / 3))).map((x) => x.o);
  const counts: Record<string, number> = {};
  for (const o of top) if (o.selectedOptionId) counts[o.selectedOptionId] = (counts[o.selectedOptionId] ?? 0) + 1;
  const keyCount = counts[key] ?? 0;
  return Object.entries(counts).some(([id, c]) => id !== key && c >= keyCount && c > 0);
}

export const FLAG_LABEL: Record<ItemFlag, string> = {
  amostra_insuficiente: "Amostra insuficiente",
  muito_facil: "Muito fácil (p > 0,90)",
  muito_dificil: "Muito difícil (p < 0,20)",
  discriminacao_baixa: "Discriminação baixa (r < 0,15)",
  discriminacao_negativa: "Discriminação negativa — revisar gabarito",
  distrator_atraente: "Distrator atraente entre melhores desempenhos — possível ambiguidade",
};
