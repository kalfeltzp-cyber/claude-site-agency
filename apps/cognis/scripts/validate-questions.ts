import { loadCategories, loadQuestions, loadReferences, loadTestVersions, BankValidationError } from "../src/lib/questions/bank";
import { blueprintShortfalls, blueprintSize } from "../src/lib/engine/selection";

try {
  const categories = loadCategories();
  const questions = loadQuestions();
  const refs = loadReferences();
  const versions = loadTestVersions();
  console.log(`${questions.length} questões válidas em ${categories.length} categorias; ${refs.length} referências.`);
  for (const c of categories) {
    const qs = questions.filter((q) => q.category === c.id);
    const d = [1, 2, 3].map((n) => qs.filter((q) => q.difficulty === n).length);
    console.log(`  ${c.id.padEnd(14)} ${qs.length} itens (fácil ${d[0]}, médio ${d[1]}, difícil ${d[2]})`);
  }
  for (const v of versions) {
    const short = blueprintShortfalls(
      questions.map((q) => ({ id: q.id, category: q.category, difficulty: q.difficulty, optionIds: [] })),
      v.blueprint,
    );
    console.log(`versão ${v.id}: ${blueprintSize(v.blueprint)} itens por tentativa — ${short.length ? "INSUFICIENTE" : "ok"}`);
    if (short.length) process.exitCode = 1;
  }
} catch (e) {
  if (e instanceof BankValidationError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
