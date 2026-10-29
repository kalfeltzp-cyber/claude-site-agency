import { describe, expect, it } from "vitest";
import { selectItems, blueprintSize, BlueprintError, type SelectableQuestion } from "@/lib/engine/selection";
import { scoreAttempt, observations, SCORING_VERSION, type ScoringItem } from "@/lib/engine/scoring";
import { mulberry32, shuffle } from "@/lib/engine/rng";
import { loadQuestions, loadTestVersions } from "@/lib/questions/bank";

const bank: SelectableQuestion[] = loadQuestions().map((q) => ({
  id: q.id,
  category: q.category,
  difficulty: q.difficulty,
  optionIds: q.options.map((o) => o.id),
}));
const blueprint = loadTestVersions()[0].blueprint;

describe("rng", () => {
  it("é determinístico para a mesma semente", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("shuffle preserva os elementos", () => {
    const xs = [1, 2, 3, 4, 5, 6];
    expect(shuffle(xs, mulberry32(7)).sort()).toEqual(xs);
  });
});

describe("selectItems", () => {
  it("respeita a matriz categoria × dificuldade", () => {
    const items = selectItems(bank, blueprint, 123);
    expect(items).toHaveLength(blueprintSize(blueprint));
    const byId = new Map(bank.map((q) => [q.id, q]));
    for (const cell of blueprint.cells) {
      for (const d of [1, 2, 3] as const) {
        const n = items.filter((i) => byId.get(i.questionId)!.category === cell.category && byId.get(i.questionId)!.difficulty === d).length;
        expect(n, `${cell.category}/${d}`).toBe(cell.counts[String(d) as "1" | "2" | "3"]);
      }
    }
  });

  it("não repete questões e embaralha alternativas sem perdê-las", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const items = selectItems(bank, blueprint, seed);
      expect(new Set(items.map((i) => i.questionId)).size).toBe(items.length);
      for (const i of items) {
        const original = bank.find((q) => q.id === i.questionId)!.optionIds;
        expect(i.optionOrder.slice().sort()).toEqual(original.slice().sort());
      }
    }
  });

  it("é reprodutível com a mesma semente e varia entre sementes", () => {
    expect(selectItems(bank, blueprint, 99)).toEqual(selectItems(bank, blueprint, 99));
    expect(selectItems(bank, blueprint, 99)).not.toEqual(selectItems(bank, blueprint, 100));
  });

  it("ordena por dificuldade crescente", () => {
    const byId = new Map(bank.map((q) => [q.id, q]));
    const ds = selectItems(bank, blueprint, 5).map((i) => byId.get(i.questionId)!.difficulty);
    expect(ds).toEqual(ds.slice().sort());
  });

  it("nunca coloca duas questões seguidas da mesma categoria", () => {
    const byId = new Map(bank.map((q) => [q.id, q]));
    let adjacent = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const cats = selectItems(bank, blueprint, seed).map((i) => byId.get(i.questionId)!.category);
      for (let k = 1; k < cats.length; k++) if (cats[k] === cats[k - 1]) adjacent++;
    }
    expect(adjacent).toBe(0);
  });

  it("falha explicitamente quando o banco é insuficiente", () => {
    const small = bank.filter((q) => q.category !== "memoria");
    expect(() => selectItems(small, blueprint, 1)).toThrow(BlueprintError);
  });
});

const item = (id: string, category: string, difficulty: 1 | 2 | 3, answer: string, selected: string | null, t = 1000): ScoringItem => ({
  questionId: id,
  category,
  difficulty,
  answer,
  selectedOptionId: selected,
  timeSpentMs: t,
});

describe("scoreAttempt", () => {
  const started = new Date("2026-01-01T10:00:00Z");
  const completed = new Date("2026-01-01T10:20:00Z");

  it("conta acertos, erros e omissões e calcula o IDC", () => {
    const r = scoreAttempt({
      startedAt: started,
      completedAt: completed,
      items: [
        item("a-001", "logico", 1, "a", "a"),
        item("a-002", "logico", 2, "b", "c"),
        item("a-003", "verbal", 3, "c", null),
        item("a-004", "verbal", 1, "d", "d"),
      ],
    });
    expect(r.scoringVersion).toBe(SCORING_VERSION);
    expect([r.correct, r.incorrect, r.unanswered, r.totalItems]).toEqual([2, 1, 1, 4]);
    expect(r.percentCorrect).toBe(50);
    expect(r.performanceIndex).toBe(50);
    expect(r.totalTimeMs).toBe(20 * 60_000);
    expect(r.meanTimeMs).toBe(5 * 60_000);
    expect(r.byCategory).toEqual([
      { category: "logico", total: 2, correct: 1, incorrect: 1, unanswered: 0, percentCorrect: 50 },
      { category: "verbal", total: 2, correct: 1, incorrect: 0, unanswered: 1, percentCorrect: 50 },
    ]);
    expect(r.byDifficulty).toEqual([
      { difficulty: 1, total: 2, correct: 2, percentCorrect: 100 },
      { difficulty: 2, total: 1, correct: 0, percentCorrect: 0 },
      { difficulty: 3, total: 1, correct: 0, percentCorrect: 0 },
    ]);
  });

  it("não pondera por dificuldade (acertar um item difícil vale o mesmo que um fácil)", () => {
    const easy = scoreAttempt({ startedAt: started, completedAt: completed, items: [item("x-001", "c", 1, "a", "a"), item("x-002", "c", 3, "a", "b")] });
    const hard = scoreAttempt({ startedAt: started, completedAt: completed, items: [item("x-001", "c", 1, "a", "b"), item("x-002", "c", 3, "a", "a")] });
    expect(easy.performanceIndex).toBe(hard.performanceIndex);
  });

  it("arredonda para uma casa decimal", () => {
    const items = [item("y-001", "c", 1, "a", "a"), item("y-002", "c", 1, "a", "b"), item("y-003", "c", 1, "a", "b")];
    expect(scoreAttempt({ startedAt: started, completedAt: completed, items }).percentCorrect).toBe(33.3);
  });

  it("rejeita tentativas vazias e itens duplicados", () => {
    expect(() => scoreAttempt({ startedAt: started, completedAt: completed, items: [] })).toThrow();
    expect(() =>
      scoreAttempt({ startedAt: started, completedAt: completed, items: [item("z-001", "c", 1, "a", "a"), item("z-001", "c", 1, "a", "a")] }),
    ).toThrow();
  });

  it("nunca produz tempo negativo", () => {
    const r = scoreAttempt({ startedAt: completed, completedAt: started, items: [item("w-001", "c", 1, "a", "a", -50)] });
    expect(r.totalTimeMs).toBe(0);
    expect(r.items[0].timeSpentMs).toBe(0);
  });

  it("classifica pontos fortes e categorias de menor desempenho", () => {
    const obs = observations({
      byCategory: [
        { category: "a", total: 4, correct: 4, incorrect: 0, unanswered: 0, percentCorrect: 100 },
        { category: "b", total: 4, correct: 2, incorrect: 2, unanswered: 0, percentCorrect: 50 },
        { category: "c", total: 3, correct: 2, incorrect: 1, unanswered: 0, percentCorrect: 66.7 },
        { category: "d", total: 3, correct: 0, incorrect: 3, unanswered: 0, percentCorrect: 0 },
      ],
    });
    expect(obs.strengths.map((c) => c.category)).toEqual(["a"]);
    expect(obs.lowerPerformance.map((c) => c.category)).toEqual(["d", "b"]);
  });
});
