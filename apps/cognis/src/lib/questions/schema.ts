import { z } from "zod";

/**
 * Esquema canônico de uma questão. É usado para validar os arquivos em
 * data/questions, as edições feitas no painel administrativo e os registros
 * lidos do banco. Questões novas podem ser cadastradas sem alterar código.
 */

export const SHAPES = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "star",
  "arrow",
  "fshape",
] as const;
export const FILLS = ["solid", "outline", "striped"] as const;
export const FORMATS = ["text", "matrix", "sequence", "figure_choice", "memory"] as const;
export const STATUSES = ["draft", "reviewed", "retired"] as const;

export const glyphSchema = z
  .object({
    shape: z.enum(SHAPES),
    fill: z.enum(FILLS).default("outline"),
    rotation: z
      .number()
      .int()
      .refine((r) => r % 45 === 0 && r >= 0 && r < 360, "rotação deve ser múltiplo de 45° em [0, 360)")
      .default(0),
    mirror: z.boolean().default(false),
    count: z.number().int().min(1).max(9).default(1),
  })
  .strict();

export type Glyph = z.infer<typeof glyphSchema>;
export type GlyphInput = z.input<typeof glyphSchema>;

export const optionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,32}$/),
    text: z.string().min(1).max(300).optional(),
    figure: glyphSchema.optional(),
  })
  .strict()
  .refine((o) => Boolean(o.text) !== Boolean(o.figure), "a alternativa deve ter texto OU figura");

export const figureSchema = z
  .object({
    /** Matriz 3×3 em ordem de leitura; `null` marca a célula ausente. */
    matrix: z.array(glyphSchema.nullable()).length(9).optional(),
    /** Sequência de figuras; o próximo elemento é a resposta. */
    sequence: z.array(glyphSchema).min(3).max(8).optional(),
    /** Figura-modelo para itens espaciais. */
    model: glyphSchema.optional(),
  })
  .strict();

export const stimulusSchema = z
  .object({
    text: z.string().min(1).max(200),
    exposureSeconds: z.number().int().min(3).max(30),
  })
  .strict();

export const qualitySchema = z
  .object({
    reviewStatus: z.enum(["pending", "author_reviewed", "peer_reviewed"]).default("pending"),
    reviewedAt: z.string().optional(),
    notes: z.string().max(1000).optional(),
    empiricallyCalibrated: z.boolean().default(false),
  })
  .strict();

/** Parâmetros IRT só são usados quando `calibrated` é verdadeiro e há fonte da estimação. */
export const irtSchema = z
  .object({
    model: z.enum(["rasch", "2pl"]),
    a: z.number().positive().default(1),
    b: z.number(),
    calibrated: z.boolean(),
    sampleSize: z.number().int().nonnegative().optional(),
    source: z.string().optional(),
  })
  .strict();

export const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z]{2,4}-\d{3}$/, "formato do id: abc-001"),
    version: z.number().int().min(1).default(1),
    locale: z.string().default("pt-BR"),
    category: z.string().min(2).max(40),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    format: z.enum(FORMATS),
    prompt: z.string().min(5).max(800),
    stimulus: stimulusSchema.optional(),
    figure: figureSchema.optional(),
    options: z.array(optionSchema).min(4).max(6),
    answer: z.string(),
    explanation: z.string().min(10).max(1500),
    rationale: z.string().min(5).max(800),
    recommendedSeconds: z.number().int().min(10).max(300),
    status: z.enum(STATUSES).default("draft"),
    active: z.boolean().default(true),
    tags: z.array(z.string()).default([]),
    quality: qualitySchema.default({ reviewStatus: "pending", empiricallyCalibrated: false }),
    irt: irtSchema.optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    const ids = q.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "ids de alternativas duplicados" });
    }
    if (!ids.includes(q.answer)) {
      ctx.addIssue({ code: "custom", message: `gabarito "${q.answer}" não corresponde a nenhuma alternativa` });
    }
    const texts = q.options.filter((o) => o.text).map((o) => o.text!.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) {
      ctx.addIssue({ code: "custom", message: "alternativas com texto duplicado" });
    }
    const figs = q.options.filter((o) => o.figure).map((o) => JSON.stringify(o.figure));
    if (new Set(figs).size !== figs.length) {
      ctx.addIssue({ code: "custom", message: "alternativas com figura duplicada" });
    }
    const needsFigureOptions = q.format === "matrix" || q.format === "sequence" || q.format === "figure_choice";
    if (needsFigureOptions && q.options.some((o) => !o.figure)) {
      ctx.addIssue({ code: "custom", message: "itens figurais exigem alternativas figurais" });
    }
    if (q.format === "matrix" && (!q.figure?.matrix || q.figure.matrix.filter((c) => c === null).length !== 1)) {
      ctx.addIssue({ code: "custom", message: "matriz deve ter exatamente uma célula ausente" });
    }
    if (q.format === "sequence" && !q.figure?.sequence) {
      ctx.addIssue({ code: "custom", message: "item de sequência sem figura" });
    }
    if (q.format === "figure_choice" && !q.figure?.model) {
      ctx.addIssue({ code: "custom", message: "item espacial sem figura-modelo" });
    }
    if (q.format === "memory" && !q.stimulus) {
      ctx.addIssue({ code: "custom", message: "item de memória sem estímulo" });
    }
    if (q.format !== "memory" && q.stimulus) {
      ctx.addIssue({ code: "custom", message: "apenas itens de memória têm estímulo" });
    }
    if (q.irt?.calibrated && !q.irt.source) {
      ctx.addIssue({ code: "custom", message: "parâmetros calibrados exigem fonte da calibração" });
    }
  });

export type Question = z.infer<typeof questionSchema>;
export type QuestionInput = z.input<typeof questionSchema>;
export type QuestionOption = z.infer<typeof optionSchema>;

export const categorySchema = z
  .object({
    id: z.string().regex(/^[a-z_]{2,40}$/),
    name: z.string().min(2).max(80),
    description: z.string().min(5).max(500),
    construct: z.string().min(2).max(200),
    practice: z.array(z.string()).min(1).max(6),
    sortOrder: z.number().int(),
    active: z.boolean().default(true),
  })
  .strict();

export type Category = z.infer<typeof categorySchema>;

export const blueprintSchema = z
  .object({
    /** Quantidade por categoria e dificuldade (1 = fácil, 2 = médio, 3 = difícil). */
    cells: z.array(
      z.object({
        category: z.string(),
        counts: z.object({ "1": z.number().int().min(0), "2": z.number().int().min(0), "3": z.number().int().min(0) }),
      }),
    ),
  })
  .strict();

export type Blueprint = z.infer<typeof blueprintSchema>;

export const testVersionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{2,40}$/),
    name: z.string().min(2).max(120),
    status: z.enum(["draft", "active", "retired"]),
    timeLimitSeconds: z.number().int().min(300).max(7200),
    blueprint: blueprintSchema,
    notes: z.string().max(2000).default(""),
  })
  .strict();

export type TestVersion = z.infer<typeof testVersionSchema>;

export const referenceSchema = z
  .object({
    id: z.string(),
    authors: z.string(),
    year: z.number().int(),
    title: z.string(),
    source: z.string(),
    doi: z.string().optional(),
    url: z.string().url(),
    topic: z.string(),
    usedFor: z.string(),
  })
  .strict();

export type ScientificReference = z.infer<typeof referenceSchema>;
