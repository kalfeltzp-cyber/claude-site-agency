"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Category, Question } from "@/lib/questions/schema";
import { FORMATS, questionSchema } from "@/lib/questions/schema";
import { Button } from "../ui/button";
import { QuestionFigure, GlyphCell } from "../figures/figure";
import { ApiError, api } from "../assessment/api";

const input = "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
const label = "block text-sm text-muted";

const EMPTY: Question = {
  id: "",
  version: 1,
  locale: "pt-BR",
  category: "",
  difficulty: 1,
  format: "text",
  prompt: "",
  options: [
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ],
  answer: "a",
  explanation: "",
  rationale: "",
  recommendedSeconds: 45,
  status: "draft",
  active: true,
  tags: [],
  quality: { reviewStatus: "pending", empiricallyCalibrated: false },
};

export function QuestionEditor({ initial, categories }: { initial: Question | null; categories: Category[] }) {
  const router = useRouter();
  const isNew = !initial;
  const start = initial ?? { ...EMPTY, category: categories[0]?.id ?? "" };
  const [q, setQ] = useState<Question>(start);
  const [optionsJson, setOptionsJson] = useState(JSON.stringify(start.options, null, 2));
  const [figureJson, setFigureJson] = useState(start.figure ? JSON.stringify(start.figure, null, 2) : "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const draft = useMemo(() => {
    try {
      const options = JSON.parse(optionsJson);
      const figure = figureJson.trim() ? JSON.parse(figureJson) : undefined;
      const obj = { ...q, options, figure, stimulus: q.format === "memory" ? q.stimulus : undefined };
      const parsed = questionSchema.safeParse(obj);
      return parsed.success
        ? { ok: true as const, value: parsed.data }
        : { ok: false as const, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "questão"}: ${i.message}`) };
    } catch (e) {
      return { ok: false as const, errors: [`JSON inválido: ${(e as Error).message}`] };
    }
  }, [q, optionsJson, figureJson]);

  const set = <K extends keyof Question>(k: K, v: Question[K]) => setQ((prev) => ({ ...prev, [k]: v }));

  async function save() {
    if (!draft.ok) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      if (isNew) {
        await api("/api/admin/questions", { method: "POST", body: draft.value });
        router.replace(`/admin/questoes/${draft.value.id}`);
      } else {
        const r = await api<{ version: number }>(`/api/admin/questions/${q.id}`, { method: "PUT", body: draft.value });
        setQ((prev) => ({ ...prev, version: r.version }));
        setSaved(`Salvo (versão ${r.version}).`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={label}>
            Id
            <input className={input} value={q.id} readOnly={!isNew} placeholder="abc-001" onChange={(e) => set("id", e.target.value)} required />
          </label>
          <label className={label}>
            Categoria
            <select className={input} value={q.category} onChange={(e) => set("category", e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Dificuldade
            <select className={input} value={q.difficulty} onChange={(e) => set("difficulty", Number(e.target.value) as 1 | 2 | 3)}>
              <option value={1}>Fácil</option>
              <option value={2}>Médio</option>
              <option value={3}>Difícil</option>
            </select>
          </label>
          <label className={label}>
            Formato
            <select className={input} value={q.format} onChange={(e) => set("format", e.target.value as Question["format"])}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Estado
            <select className={input} value={q.status} onChange={(e) => set("status", e.target.value as Question["status"])}>
              <option value="draft">rascunho</option>
              <option value="reviewed">revisada</option>
              <option value="retired">aposentada</option>
            </select>
          </label>
          <label className={label}>
            Tempo recomendado (s)
            <input type="number" min={10} max={300} className={input} value={q.recommendedSeconds} onChange={(e) => set("recommendedSeconds", Number(e.target.value))} />
          </label>
        </div>
        <label className={label}>
          Enunciado
          <textarea className={input} rows={4} value={q.prompt} onChange={(e) => set("prompt", e.target.value)} />
        </label>
        {q.format === "memory" && (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className={label}>
              Estímulo de memória
              <input className={input} value={q.stimulus?.text ?? ""} onChange={(e) => set("stimulus", { text: e.target.value, exposureSeconds: q.stimulus?.exposureSeconds ?? 8 })} />
            </label>
            <label className={label}>
              Exposição (s)
              <input type="number" min={3} max={30} className={input} value={q.stimulus?.exposureSeconds ?? 8} onChange={(e) => set("stimulus", { text: q.stimulus?.text ?? "", exposureSeconds: Number(e.target.value) })} />
            </label>
          </div>
        )}
        <label className={label}>
          Alternativas (JSON: lista de {"{ id, text }"} ou {"{ id, figure }"})
          <textarea className={`${input} font-mono`} rows={8} value={optionsJson} onChange={(e) => setOptionsJson(e.target.value)} spellCheck={false} />
        </label>
        <label className={label}>
          Gabarito (id da alternativa)
          <input className={input} value={q.answer} onChange={(e) => set("answer", e.target.value)} />
        </label>
        {q.format !== "text" && q.format !== "memory" && (
          <label className={label}>
            Figura (JSON: {"{ matrix }"}, {"{ sequence }"} ou {"{ model }"})
            <textarea className={`${input} font-mono`} rows={6} value={figureJson} onChange={(e) => setFigureJson(e.target.value)} spellCheck={false} />
          </label>
        )}
        <label className={label}>
          Explicação da solução
          <textarea className={input} rows={3} value={q.explanation} onChange={(e) => set("explanation", e.target.value)} />
        </label>
        <label className={label}>
          Fonte ou justificativa técnica
          <textarea className={input} rows={2} value={q.rationale} onChange={(e) => set("rationale", e.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Revisão
            <select className={input} value={q.quality.reviewStatus} onChange={(e) => set("quality", { ...q.quality, reviewStatus: e.target.value as Question["quality"]["reviewStatus"], reviewedAt: new Date().toISOString().slice(0, 10) })}>
              <option value="pending">pendente</option>
              <option value="author_reviewed">revisada pelo autor</option>
              <option value="peer_reviewed">revisada por pares</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm text-muted">
            <input type="checkbox" checked={q.active} onChange={(e) => set("active", e.target.checked)} className="size-4" /> Ativa
          </label>
        </div>
        <label className={label}>
          Notas de qualidade
          <textarea className={input} rows={2} value={q.quality.notes ?? ""} onChange={(e) => set("quality", { ...q.quality, notes: e.target.value })} />
        </label>

        {!draft.ok && (
          <ul role="alert" className="space-y-1 rounded-lg border border-warn/40 bg-warn/[0.07] p-3 text-sm text-warn">
            {draft.errors.map((er) => (
              <li key={er}>{er}</li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        {saved && <p role="status" className="text-sm text-good">{saved}</p>}
        <Button type="submit" disabled={!draft.ok || busy}>{busy ? "Salvando…" : isNew ? "Criar questão" : "Salvar alterações"}</Button>
        <p className="text-xs text-faint">Somente questões “revisadas” e ativas entram no sorteio. Editar incrementa a versão do item.</p>
      </form>

      <aside className="h-fit rounded-2xl border border-line bg-surface p-6 lg:sticky lg:top-24">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">Pré-visualização</p>
        {draft.ok ? (
          <div className="mt-4 space-y-4">
            {draft.value.stimulus && <p className="rounded-lg bg-surface-2 p-3 text-center font-mono">{draft.value.stimulus.text}</p>}
            <p className="whitespace-pre-line text-ink">{draft.value.prompt}</p>
            <QuestionFigure figure={draft.value.figure ?? null} />
            <ul className="grid grid-cols-2 gap-2">
              {draft.value.options.map((o) => (
                <li key={o.id} className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${o.id === draft.value.answer ? "border-good/60" : "border-line"}`}>
                  <span className="font-mono text-xs text-muted">{o.id}</span>
                  {o.figure ? <GlyphCell glyph={o.figure} className="size-12" /> : o.text}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Corrija os erros para ver a pré-visualização.</p>
        )}
      </aside>
    </div>
  );
}
