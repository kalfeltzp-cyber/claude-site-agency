import type { Difficulty } from "./types";

/**
 * Algoritmo de pontuação "IDC 1.0" (Índice de Desempenho Cognitivo).
 *
 * Documentado em /metodologia. Regras:
 *  1. Cada item vale 1 ponto se a alternativa escolhida for o gabarito, 0 caso contrário.
 *  2. Itens não respondidos valem 0 e são contados à parte.
 *  3. IDC = 100 × acertos ÷ total de itens apresentados (uma casa decimal).
 *  4. A dificuldade NÃO pondera o escore: os níveis foram atribuídos pelos autores e
 *     não foram calibrados empiricamente. Ela é usada apenas para relatório.
 *  5. O IDC não é QI e não é comparado a normas populacionais.
 */
export const SCORING_VERSION = "idc-1.0";

export interface ScoringItem {
  questionId: string;
  category: string;
  difficulty: Difficulty;
  answer: string;
  selectedOptionId: string | null;
  timeSpentMs: number;
}

export interface ScoringInput {
  items: ScoringItem[];
  startedAt: Date;
  completedAt: Date;
}

export interface CategoryScore {
  category: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentCorrect: number;
}

export interface DifficultyScore {
  difficulty: Difficulty;
  total: number;
  correct: number;
  percentCorrect: number;
}

export interface ItemOutcome {
  questionId: string;
  category: string;
  difficulty: Difficulty;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  timeSpentMs: number;
}

export interface ScoreResult {
  scoringVersion: string;
  totalItems: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentCorrect: number;
  performanceIndex: number;
  totalTimeMs: number;
  meanTimeMs: number;
  byCategory: CategoryScore[];
  byDifficulty: DifficultyScore[];
  items: ItemOutcome[];
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (num: number, den: number) => (den === 0 ? 0 : round1((100 * num) / den));

export function scoreAttempt(input: ScoringInput): ScoreResult {
  const { items } = input;
  if (items.length === 0) throw new Error("Não é possível pontuar uma tentativa sem itens");
  const ids = new Set(items.map((i) => i.questionId));
  if (ids.size !== items.length) throw new Error("Itens duplicados na tentativa");

  const outcomes: ItemOutcome[] = items.map((i) => ({
    questionId: i.questionId,
    category: i.category,
    difficulty: i.difficulty,
    selectedOptionId: i.selectedOptionId,
    isCorrect: i.selectedOptionId === null ? null : i.selectedOptionId === i.answer,
    timeSpentMs: Math.max(0, Math.round(i.timeSpentMs)),
  }));

  const correct = outcomes.filter((o) => o.isCorrect === true).length;
  const unanswered = outcomes.filter((o) => o.isCorrect === null).length;
  const incorrect = outcomes.length - correct - unanswered;

  const categories = [...new Set(outcomes.map((o) => o.category))];
  const byCategory = categories.map((category) => {
    const subset = outcomes.filter((o) => o.category === category);
    const c = subset.filter((o) => o.isCorrect === true).length;
    const u = subset.filter((o) => o.isCorrect === null).length;
    return {
      category,
      total: subset.length,
      correct: c,
      incorrect: subset.length - c - u,
      unanswered: u,
      percentCorrect: pct(c, subset.length),
    };
  });

  const byDifficulty = ([1, 2, 3] as Difficulty[])
    .map((difficulty) => {
      const subset = outcomes.filter((o) => o.difficulty === difficulty);
      const c = subset.filter((o) => o.isCorrect === true).length;
      return { difficulty, total: subset.length, correct: c, percentCorrect: pct(c, subset.length) };
    })
    .filter((d) => d.total > 0);

  const totalTimeMs = Math.max(0, input.completedAt.getTime() - input.startedAt.getTime());
  const percentCorrect = pct(correct, outcomes.length);

  return {
    scoringVersion: SCORING_VERSION,
    totalItems: outcomes.length,
    correct,
    incorrect,
    unanswered,
    percentCorrect,
    performanceIndex: percentCorrect,
    totalTimeMs,
    meanTimeMs: Math.round(totalTimeMs / outcomes.length),
    byCategory,
    byDifficulty,
    items: outcomes,
  };
}

export interface Observations {
  strengths: CategoryScore[];
  lowerPerformance: CategoryScore[];
}

/**
 * Pontos fortes = categorias com ≥ 75% de acerto; menor desempenho = ≤ 50%.
 * Com 3–4 itens por categoria, cada item muda o percentual em 25–33 pontos;
 * por isso a interface sempre exibe o número de itens junto do percentual.
 */
export function observations(result: Pick<ScoreResult, "byCategory">): Observations {
  const sorted = result.byCategory.slice().sort((a, b) => b.percentCorrect - a.percentCorrect || a.category.localeCompare(b.category));
  return {
    strengths: sorted.filter((c) => c.percentCorrect >= 75),
    lowerPerformance: sorted.filter((c) => c.percentCorrect <= 50).reverse(),
  };
}
