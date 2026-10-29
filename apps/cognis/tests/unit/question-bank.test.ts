import { describe, expect, it } from "vitest";
import { loadCategories, loadQuestions, loadReferences, loadTestVersions } from "@/lib/questions/bank";
import { questionSchema, type Glyph, type Question } from "@/lib/questions/schema";
import { blueprintShortfalls } from "@/lib/engine/selection";

const questions = loadQuestions();
const byId = new Map(questions.map((q) => [q.id, q]));
const answerText = (id: string) => {
  const q = byId.get(id)!;
  return q.options.find((o) => o.id === q.answer)!.text!;
};
const answerFigure = (id: string): Glyph => {
  const q = byId.get(id)!;
  return q.options.find((o) => o.id === q.answer)!.figure!;
};
const letter = (n: number) => String.fromCharCode(64 + n); // 1 → A

describe("integridade estrutural do banco", () => {
  it("tem pelo menos 60 questões originais em 10 categorias", () => {
    expect(questions.length).toBeGreaterThanOrEqual(60);
    expect(new Set(questions.map((q) => q.category)).size).toBe(loadCategories().length);
  });

  it("todas passam no esquema, com ids únicos e revisão registrada", () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    for (const q of questions) {
      expect(questionSchema.safeParse(q).success, q.id).toBe(true);
      expect(q.status).toBe("reviewed");
      expect(q.quality.reviewStatus).not.toBe("pending");
      expect(q.quality.empiricallyCalibrated).toBe(false);
      expect(q.irt?.calibrated ?? false).toBe(false);
    }
  });

  it("nenhum enunciado é duplicado", () => {
    const keys = questions.map((q) => `${q.prompt}|${JSON.stringify(q.figure ?? null)}|${q.stimulus?.text ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("a matriz da versão ativa é viável", () => {
    for (const v of loadTestVersions()) {
      const short = blueprintShortfalls(
        questions.map((q) => ({ id: q.id, category: q.category, difficulty: q.difficulty, optionIds: [] })),
        v.blueprint,
      );
      expect(short).toEqual([]);
    }
  });

  it("referências têm URL e DOI bem formados quando presentes", () => {
    for (const r of loadReferences()) {
      expect(r.url).toMatch(/^https:\/\//);
      if (r.doi) {
        expect(r.doi).toMatch(/^10\.\d{4,9}\/\S+$/);
        expect(r.url).toBe(`https://doi.org/${r.doi}`);
      }
    }
  });
});

/**
 * Verificação independente dos gabaritos: cada solucionador recalcula a
 * resposta a partir do enunciado/estímulo, sem consultar o campo "answer".
 */
describe("gabaritos recalculados de forma independente", () => {
  const seqNext = (id: string, f: (xs: number[]) => number) => {
    const line = byId.get(id)!.prompt.split("\n")[1];
    const xs = line.split(",").map((s) => s.trim()).filter((s) => s !== "?").map(Number);
    return String(f(xs));
  };

  it("sequências numéricas", () => {
    expect(answerText("num-001")).toBe(seqNext("num-001", (x) => x.at(-1)! + (x[1] - x[0])));
    expect(answerText("num-002")).toBe(seqNext("num-002", (x) => x.at(-1)! * (x[1] / x[0])));
    expect(answerText("num-003")).toBe(seqNext("num-003", (x) => x.at(-1)! * (x[1] / x[0])));
    expect(answerText("num-004")).toBe(seqNext("num-004", (x) => (x.length + 1) ** 2 + 1));
    expect(answerText("num-005")).toBe(seqNext("num-005", (x) => 2 * x.at(-1)! - 2));
    expect(answerText("num-006")).toBe(seqNext("num-006", (x) => 2 * x.at(-1)! - 1));
    expect(answerText("num-007")).toBe(seqNext("num-007", (x) => x[x.length - 2] * 2)); // série ímpar
    expect(answerText("num-008")).toBe(seqNext("num-008", (x) => x.at(-1)! + x.length ** 2));
  });

  it("raciocínio quantitativo", () => {
    expect(answerText("qnt-001")).toBe("R$ 60,00"); // 80 × 0,75
    expect(80 * 0.75).toBe(60);
    expect(answerText("qnt-002")).toBe(`R$ ${(18 / 3) * 7},00`);
    expect(Math.round((1.2 * 0.8 - 1) * 100)).toBe(-4);
    expect(answerText("qnt-003")).toBe("4% menor");
    expect(answerText("qnt-004")).toBe(String(5 * 12 - 4 * 10));
    expect(1 / (1 / 6 + 1 / 3)).toBeCloseTo(2, 10);
    expect(answerText("qnt-005")).toBe("2 h");
    expect(answerText("qnt-006")).toBe(`${60 + 50 - (100 - 20)}%`);
    expect(answerText("qnt-007")).toBe(`${120 / (60 / 60 + 60 / 40)} km/h`);
  });

  it("padrões de letras", () => {
    expect(answerText("pad-001")).toBe(letter(1 + 2 * 4));
    expect(answerText("pad-003")).toBe(letter(14 + 6));
    expect(answerText("pad-004")).toBe(letter(5) + letter(27 - 5));
    expect(answerText("pad-006")).toBe(letter(10) + letter(12) + letter(11));
    expect(answerText("pad-007")).toBe(`${2 ** 5}${letter(1 + 3 * 4)}`);
  });

  it("memória de trabalho (calculado a partir do estímulo)", () => {
    const digits = (id: string) => byId.get(id)!.stimulus!.text.split(/\s+/).filter(Boolean).map(Number);
    expect(answerText("mem-001")).toBe(String(digits("mem-001")[2]));
    const words = byId.get("mem-002")!.stimulus!.text.split("·").map((w) => w.trim());
    const notIn = byId.get("mem-002")!.options.filter((o) => !words.includes(o.text!));
    expect(notIn.map((o) => o.id)).toEqual([byId.get("mem-002")!.answer]);
    expect(answerText("mem-003")).toBe(digits("mem-003").reverse().join(" "));
    const pairs = Object.fromEntries(byId.get("mem-004")!.stimulus!.text.split("·").map((p) => [p.trim()[0], p.trim().slice(1)]));
    expect(answerText("mem-004")).toBe(pairs.M);
    const d5 = digits("mem-005");
    expect(answerText("mem-005")).toBe(String(d5[1] + d5[4]));
    const letters6 = byId.get("mem-006")!.stimulus!.text.split(/\s+/).filter((t) => /[A-Z]/.test(t)).sort();
    expect(answerText("mem-006")).toBe(letters6[2]);
    expect(answerText("mem-007")).toBe(String(digits("mem-007").filter((d) => d > 5).length));
  });

  it("resolução de problemas", () => {
    const end = 14 * 60 + 40 + 95;
    expect(answerText("prb-001")).toBe(`${Math.floor(end / 60)}h${String(end % 60).padStart(2, "0")}`);
    expect(answerText("prb-002")).toBe(String(Math.floor(12 / 1.5)));
    let h = 0;
    let day = 0;
    while (true) {
      day++;
      h += 3;
      if (h >= 10) break;
      h -= 2;
    }
    expect(answerText("prb-003")).toBe(`No ${day}º dia`);
    expect(answerText("prb-004")).toBe(String((6 * 5) / 2));
    expect(answerText("prb-005")).toBe(`18h${String(6 * 2).padStart(2, "0")}`);
    expect(answerText("prb-006")).toBe(String(32 - 1));
    let sevens = 0;
    for (let p = 1; p <= 120; p++) sevens += [...String(p)].filter((c) => c === "7").length;
    expect(answerText("prb-007")).toBe(String(sevens));
    let weighings = 0;
    for (let cases = 1; cases < 9; cases *= 3) weighings++; // cada pesagem distingue 3 resultados
    expect(answerText("prb-008")).toBe(String(weighings));
  });

  it("relações espaciais numéricas", () => {
    expect(answerText("esp-005")).toBe(String(12 * (3 - 2)));
    expect(answerText("esp-006")).toBe(String(7 - 2 + (7 - 3)));
    expect(answerText("esp-007")).toBe(String((4 - 2) ** 3));
    const dirs = ["Norte", "Leste", "Sul", "Oeste"];
    expect(answerText("esp-001")).toBe(dirs[(0 + 1 + 2) % 4]);
  });

  it("lógica por enumeração exaustiva", () => {
    // log-004: permutações compatíveis com as restrições.
    const names = ["Bruno", "Tiago", "Paulo", "Diego", "Ênio"];
    const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
    const valid = perms(names).filter((p) => {
      const pos = (n: string) => p.indexOf(n);
      return pos("Tiago") < pos("Paulo") && pos("Tiago") > pos("Bruno") && pos("Diego") > pos("Paulo") && pos("Ênio") === 0;
    });
    expect(valid).toHaveLength(1);
    expect(answerText("log-004")).toBe(valid[0][2]);

    // log-008: exatamente uma frase verdadeira.
    const culprits = ["Ana", "Beto", "Caio"].filter((c) => [c === "Beto", c !== "Beto", c !== "Caio"].filter(Boolean).length === 1);
    expect(culprits).toEqual(["Caio"]);
    expect(answerText("log-008")).toBe("Caio");

    // log-007: cavaleiros e patifes.
    const sols = [true, false].flatMap((rui) => [true, false].map((sara) => ({ rui, sara }))).filter(({ rui, sara }) => rui === (!rui && !sara));
    expect(sols).toEqual([{ rui: false, sara: true }]);

    // log-002: alocação de cadeiras.
    const seats = perms(["João", "Kátia", "Leo", "Mia"]).filter((p) => p[0] === "João" && p[1] === "Mia" && p[3] !== "Leo");
    expect(seats).toHaveLength(1);
    expect(answerText("log-002")).toBe(seats[0][3]);
  });

  /** Utilitários para matrizes figurais. */
  const cells = (q: Question) => q.figure!.matrix!;
  const same = (a: Glyph, b: Glyph) => JSON.stringify(a) === JSON.stringify(b);

  it("matrizes com regra de quadrado latino (abs-003, abs-006)", () => {
    for (const id of ["abs-003", "abs-006"]) {
      const q = byId.get(id)!;
      const grid = cells(q).map((c) => c ?? answerFigure(id));
      const attrs: (keyof Glyph)[] = id === "abs-003" ? ["shape", "fill"] : ["fill", "count"];
      for (const attr of attrs) {
        for (let k = 0; k < 3; k++) {
          const row = new Set([0, 1, 2].map((j) => grid[k * 3 + j][attr]));
          const col = new Set([0, 1, 2].map((j) => grid[j * 3 + k][attr]));
          expect(row.size, `${id} linha ${k} ${attr}`).toBe(3);
          expect(col.size, `${id} coluna ${k} ${attr}`).toBe(3);
        }
      }
      // Nenhum distrator satisfaz todas as regras.
      for (const o of q.options.filter((o) => o.id !== q.answer)) {
        const g = cells(q).map((c) => c ?? o.figure!);
        const ok = attrs.every((attr) =>
          [0, 1, 2].every((k) => new Set([0, 1, 2].map((j) => g[k * 3 + j][attr])).size === 3 && new Set([0, 1, 2].map((j) => g[j * 3 + k][attr])).size === 3),
        ) && (id !== "abs-006" || o.figure!.shape === "triangle");
        expect(ok, `${id} distrator ${o.id}`).toBe(false);
      }
    }
  });

  it("matrizes de progressão (abs-001, abs-002, abs-004, abs-005, abs-007)", () => {
    const m1 = cells(byId.get("abs-001")!);
    expect(same(answerFigure("abs-001"), { ...m1[7]!, count: m1[7]!.count + 1 } as Glyph)).toBe(true);
    const m2 = cells(byId.get("abs-002")!);
    expect(same(answerFigure("abs-002"), { ...m2[6]!, fill: m2[2]!.fill } as Glyph)).toBe(true);
    const m4 = cells(byId.get("abs-004")!);
    expect(answerFigure("abs-004").rotation).toBe((m4[7]!.rotation + 45) % 360);
    const m5 = cells(byId.get("abs-005")!);
    expect(answerFigure("abs-005").count).toBe(m5[6]!.count + m5[7]!.count);
    expect(answerFigure("abs-005").shape).toBe(m5[6]!.shape);
    const m7 = cells(byId.get("abs-007")!);
    expect(answerFigure("abs-007")).toEqual({ ...m7[7]!, rotation: (m7[7]!.rotation + 90) % 360 });
  });

  it("sequências figurais e rotação mental", () => {
    const s2 = byId.get("pad-002")!.figure!.sequence!;
    expect(answerFigure("pad-002").rotation).toBe((s2.at(-1)!.rotation + 90) % 360);
    const s5 = byId.get("pad-005")!.figure!.sequence!;
    expect(answerFigure("pad-005")).toEqual({ ...s5[0], count: s5.length + 1 });
    const s8 = byId.get("pad-008")!.figure!.sequence!;
    expect(answerFigure("pad-008")).toEqual({ ...s8[0], rotation: (s8.at(-1)!.rotation + 45) % 360 });

    expect(answerFigure("esp-003")).toMatchObject({ rotation: 90, mirror: false });
    const esp4 = byId.get("esp-004")!;
    expect(esp4.options.filter((o) => !o.figure!.mirror).map((o) => o.id)).toEqual([esp4.answer]);
    expect(answerFigure("esp-008")).toMatchObject({ rotation: 90, mirror: true });
  });
});
