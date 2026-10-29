import { describe, expect, it } from "vitest";
import { estimateAbility, probability, testInformation } from "@/lib/engine/irt";
import { normedScore, type NormTable } from "@/lib/engine/norms";
import { histogram, mean, median, pearson, sd } from "@/lib/stats/descriptive";
import { analyzeItems, MIN_ITEM_SAMPLE } from "@/lib/stats/items";

describe("IRT", () => {
  it("P(θ = b) = 0,5 e cresce com θ", () => {
    expect(probability(0.7, { a: 1.3, b: 0.7 })).toBeCloseTo(0.5, 10);
    expect(probability(2, { a: 1, b: 0 })).toBeGreaterThan(probability(1, { a: 1, b: 0 }));
  });

  it("informação do item no modelo Rasch é máxima em θ = b (0,25)", () => {
    expect(testInformation(0, [{ a: 1, b: 0 }])).toBeCloseTo(0.25, 10);
  });

  it("não estima habilidade com itens não calibrados", () => {
    expect(estimateAbility([{ correct: true, params: { a: 1, b: 0, calibrated: false } }])).toBeNull();
    expect(estimateAbility([])).toBeNull();
  });

  it("EAP é simétrica e monotônica com parâmetros calibrados", () => {
    const params = [-1, -0.5, 0, 0.5, 1].map((b) => ({ a: 1, b, calibrated: true }));
    const all = estimateAbility(params.map((p) => ({ correct: true, params: p })))!;
    const none = estimateAbility(params.map((p) => ({ correct: false, params: p })))!;
    expect(all.theta).toBeCloseTo(-none.theta, 6);
    expect(all.theta).toBeGreaterThan(0);
    const half = estimateAbility(params.map((p, i) => ({ correct: i < 3, params: p })))!;
    expect(half.theta).toBeGreaterThan(none.theta);
    expect(half.theta).toBeLessThan(all.theta);
    expect(half.standardError).toBeGreaterThan(0);
  });
});

describe("normas", () => {
  const base: NormTable = {
    id: "n1",
    testVersionId: "v1",
    population: "teste",
    sampleSize: 5000,
    collectedFrom: "2026-01-01",
    collectedTo: "2026-06-01",
    reliability: 0.9,
    validated: true,
    rawToStandard: { "20": 100 },
  };
  it("só converte com tabela validada, amostra mínima e confiabilidade adequada", () => {
    expect(normedScore(20, "v1", base)).toBe(100);
    expect(normedScore(20, "v1", null)).toBeNull();
    expect(normedScore(20, "v1", { ...base, validated: false })).toBeNull();
    expect(normedScore(20, "v1", { ...base, sampleSize: 100 })).toBeNull();
    expect(normedScore(20, "v1", { ...base, reliability: 0.6 })).toBeNull();
    expect(normedScore(20, "v2", base)).toBeNull();
    expect(normedScore(21, "v1", base)).toBeNull();
  });
});

describe("estatística descritiva", () => {
  it("média, mediana e desvio-padrão", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4);
    expect(mean([])).toBeNull();
    expect(sd([1])).toBeNull();
  });
  it("histograma inclui o limite superior no último intervalo", () => {
    const h = histogram([0, 10, 55, 100], 0, 100, 10);
    expect(h.map((b) => b.count)).toEqual([1, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
  it("correlação de Pearson", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 10);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe("análise de itens", () => {
  it("marca amostra insuficiente abaixo do mínimo", () => {
    const r = analyzeItems([{ attemptId: "1", questionId: "q", selectedOptionId: "a", isCorrect: true }], [{ attemptId: "1", correct: 1, total: 1 }], { q: "a" });
    expect(r[0].flags).toEqual(["amostra_insuficiente"]);
  });

  it("detecta item muito fácil e distrator atraente com amostra suficiente", () => {
    const n = MIN_ITEM_SAMPLE + 10;
    const obsEasy = Array.from({ length: n }, (_, i) => ({ attemptId: String(i), questionId: "easy", selectedOptionId: "a", isCorrect: true }));
    // Item ambíguo: quem vai melhor no restante da prova escolhe "b" (não o gabarito "a").
    const obsAmb = Array.from({ length: n }, (_, i) => {
      const pick = i >= n / 2 ? "b" : "a";
      return { attemptId: String(i), questionId: "amb", selectedOptionId: pick, isCorrect: pick === "a" };
    });
    const totals = Array.from({ length: n }, (_, i) => ({ attemptId: String(i), correct: 10 + Math.floor(i / 2), total: 40 }));
    const r = analyzeItems([...obsEasy, ...obsAmb], totals, { easy: "a", amb: "a" });
    const easy = r.find((x) => x.questionId === "easy")!;
    const amb = r.find((x) => x.questionId === "amb")!;
    expect(easy.p).toBe(1);
    expect(easy.flags).toContain("muito_facil");
    expect(amb.flags).toContain("distrator_atraente");
    expect(amb.flags).toContain("discriminacao_negativa");
    expect(amb.optionCounts).toEqual({ a: n / 2, b: n / 2 });
  });
});
