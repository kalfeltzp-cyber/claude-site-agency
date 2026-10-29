import type { Blueprint, Difficulty } from "./types";
import { mulberry32, shuffle } from "./rng";

export interface SelectableQuestion {
  id: string;
  category: string;
  difficulty: Difficulty;
  optionIds: string[];
}

export interface SelectedItem {
  position: number;
  questionId: string;
  /** Ordem de apresentação das alternativas (ids originais). */
  optionOrder: string[];
}

export class BlueprintError extends Error {}

export function blueprintSize(blueprint: Blueprint): number {
  return blueprint.cells.reduce((sum, c) => sum + c.counts["1"] + c.counts["2"] + c.counts["3"], 0);
}

/**
 * Verifica se o banco atende à matriz sem selecionar nada. Retorna a lista de
 * células com itens insuficientes (vazia = matriz viável).
 */
export function blueprintShortfalls(bank: readonly SelectableQuestion[], blueprint: Blueprint) {
  const shortfalls: { category: string; difficulty: Difficulty; required: number; available: number }[] = [];
  for (const cell of blueprint.cells) {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const required = cell.counts[String(d) as "1" | "2" | "3"];
      if (!required) continue;
      const available = bank.filter((q) => q.category === cell.category && q.difficulty === d).length;
      if (available < required) shortfalls.push({ category: cell.category, difficulty: d, required, available });
    }
  }
  return shortfalls;
}

/**
 * Seleciona itens segundo a matriz categoria × dificuldade, de forma
 * determinística para uma semente. Garante ausência de repetição, ordena a
 * prova da dificuldade menor para a maior e evita, quando possível, duas
 * questões seguidas da mesma categoria.
 */
export function selectItems(
  bank: readonly SelectableQuestion[],
  blueprint: Blueprint,
  seed: number,
): SelectedItem[] {
  const shortfalls = blueprintShortfalls(bank, blueprint);
  if (shortfalls.length) {
    const detail = shortfalls
      .map((s) => `${s.category}/dificuldade ${s.difficulty}: requer ${s.required}, há ${s.available}`)
      .join("; ");
    throw new BlueprintError(`Banco insuficiente para a matriz: ${detail}`);
  }

  const rand = mulberry32(seed);
  const byDifficulty: Record<Difficulty, SelectableQuestion[]> = { 1: [], 2: [], 3: [] };
  const sortedBank = bank.slice().sort((a, b) => a.id.localeCompare(b.id));

  for (const cell of blueprint.cells) {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const n = cell.counts[String(d) as "1" | "2" | "3"];
      if (!n) continue;
      const pool = sortedBank.filter((q) => q.category === cell.category && q.difficulty === d);
      byDifficulty[d].push(...shuffle(pool, rand).slice(0, n));
    }
  }

  const ordered: SelectableQuestion[] = [];
  for (const d of [1, 2, 3] as Difficulty[]) {
    ordered.push(...spreadCategories(shuffle(byDifficulty[d], rand), ordered.at(-1)?.category));
  }

  const ids = new Set(ordered.map((q) => q.id));
  if (ids.size !== ordered.length) throw new BlueprintError("Seleção produziu itens repetidos");

  return ordered.map((q, position) => ({
    position,
    questionId: q.id,
    optionOrder: shuffle(q.optionIds, rand),
  }));
}

/**
 * Reordena para evitar categorias adjacentes repetidas: a cada passo escolhe,
 * entre as categorias diferentes da anterior, a que tem mais itens restantes
 * (estratégia gulosa que encontra solução sempre que ela existe). Empates
 * mantêm a ordem já embaralhada.
 */
function spreadCategories(items: SelectableQuestion[], previousCategory?: string): SelectableQuestion[] {
  const remaining = items.slice();
  const result: SelectableQuestion[] = [];
  let last = previousCategory;
  while (remaining.length) {
    const counts = new Map<string, number>();
    for (const q of remaining) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
    let idx = -1;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i].category;
      if (c === last) continue;
      if (idx === -1 || counts.get(c)! > counts.get(remaining[idx].category)!) idx = i;
    }
    if (idx === -1) idx = 0;
    const [next] = remaining.splice(idx, 1);
    result.push(next);
    last = next.category;
  }
  return result;
}
