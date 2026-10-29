import fs from "node:fs";
import path from "node:path";
import {
  categorySchema,
  questionSchema,
  referenceSchema,
  testVersionSchema,
  type Category,
  type Question,
  type ScientificReference,
  type TestVersion,
} from "./schema";

/**
 * Carrega o conteúdo versionado em data/. Usado pelos scripts de seed, pelos
 * testes e pelas páginas públicas estáticas (categorias e referências).
 * Em produção, a fonte de verdade das questões é o banco de dados.
 */

const DATA_DIR = path.join(process.cwd(), "data");

export class BankValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Banco de questões inválido:\n${issues.join("\n")}`);
  }
}

interface QuestionFile {
  category: string;
  defaults?: Record<string, unknown>;
  questions: Record<string, unknown>[];
}

export function loadCategories(dir = DATA_DIR): Category[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "categories.json"), "utf8"));
  return categorySchema.array().parse(raw);
}

export function loadReferences(dir = DATA_DIR): ScientificReference[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "references.json"), "utf8"));
  return referenceSchema.array().parse(raw);
}

export function loadTestVersions(dir = DATA_DIR): TestVersion[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "test-versions.json"), "utf8"));
  return testVersionSchema.array().parse(raw);
}

export function loadQuestions(dir = DATA_DIR): Question[] {
  const qdir = path.join(dir, "questions");
  const categories = new Set(loadCategories(dir).map((c) => c.id));
  const issues: string[] = [];
  const out: Question[] = [];
  const seen = new Set<string>();

  for (const file of fs.readdirSync(qdir).filter((f) => f.endsWith(".json")).sort()) {
    const content = JSON.parse(fs.readFileSync(path.join(qdir, file), "utf8")) as QuestionFile;
    if (!categories.has(content.category)) issues.push(`${file}: categoria desconhecida "${content.category}"`);
    for (const rawQ of content.questions) {
      const merged = { category: content.category, ...content.defaults, ...rawQ };
      const parsed = questionSchema.safeParse(merged);
      if (!parsed.success) {
        issues.push(`${file} ${String(rawQ.id)}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
        continue;
      }
      const q = parsed.data;
      if (seen.has(q.id)) issues.push(`${file}: id duplicado ${q.id}`);
      if (q.category !== content.category) issues.push(`${file} ${q.id}: categoria diverge do arquivo`);
      seen.add(q.id);
      out.push(q);
    }
  }
  if (issues.length) throw new BankValidationError(issues);
  return out;
}
