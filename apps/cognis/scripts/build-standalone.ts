import fs from "node:fs";
import path from "node:path";
import { loadCategories, loadQuestions, loadTestVersions } from "../src/lib/questions/bank";

/**
 * Gera standalone/cognis.html: versão de arquivo único, sem servidor nem banco,
 * para uso pessoal em um navegador (histórico em localStorage). Usa o mesmo
 * banco de questões, o mesmo sorteio e o mesmo algoritmo de pontuação.
 */
const ROOT = path.resolve(__dirname, "..");
const version = loadTestVersions().find((v) => v.status === "active");
if (!version) throw new Error("Nenhuma versão ativa em data/test-versions.json");
const data = { version, categories: loadCategories(), questions: loadQuestions() };
const json = JSON.stringify(data).replace(/</g, "\\u003c");
const template = fs.readFileSync(path.join(ROOT, "standalone/template.html"), "utf8");
if (!template.includes("/*__DATA__*/")) throw new Error("Marcador /*__DATA__*/ ausente no template");
fs.writeFileSync(path.join(ROOT, "standalone/cognis.html"), template.replace("/*__DATA__*/", () => json));
console.log(`standalone/cognis.html gerado (${data.questions.length} questões)`);
