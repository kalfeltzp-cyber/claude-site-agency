"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AttemptState, PublicQuestion } from "@/lib/services/assessment";
import { formatClock } from "@/lib/i18n";
import { QuestionFigure, GlyphCell } from "../figures/figure";
import { LogoMark } from "../layout/logo";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { ApiError, api } from "./api";

type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

interface Pending {
  optionIndex: number | null;
  timeSpentMs: number;
}

type MemoryPhase = { kind: "intro" } | { kind: "showing"; text: string; endsAt: number; total: number } | { kind: "answer" };

const pendingKey = (id: string) => `cognis-pending-${id}`;

function loadPending(id: string): Record<string, Pending> {
  try {
    return JSON.parse(localStorage.getItem(pendingKey(id)) || "{}");
  } catch {
    return {};
  }
}

function storePending(id: string, pending: Record<string, Pending>) {
  try {
    if (Object.keys(pending).length) localStorage.setItem(pendingKey(id), JSON.stringify(pending));
    else localStorage.removeItem(pendingKey(id));
  } catch {
    // armazenamento indisponível: o envio ao servidor continua sendo a fonte de verdade
  }
}

export function AssessmentRunner({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [state, setState] = useState<AttemptState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [selections, setSelections] = useState<Record<string, number | null>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [memory, setMemory] = useState<Record<string, MemoryPhase>>({});
  const [questionsOverride, setQuestionsOverride] = useState<Record<string, PublicQuestion>>({});
  const [finishing, setFinishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showNav, setShowNav] = useState(false);

  const clockOffset = useRef(0);
  const times = useRef<Record<string, number>>({});
  const viewStart = useRef<number>(Date.now());
  const pending = useRef<Record<string, Pending>>({});
  const flushing = useRef<Promise<boolean> | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const retryDelay = useRef(2000);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaving = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const finishDialog = useRef<HTMLDialogElement>(null);
  const abandonDialog = useRef<HTMLDialogElement>(null);
  const autoFinished = useRef(false);

  // ------------------------------------------------------------ carregamento
  const load = useCallback(async () => {
    try {
      const s = await api<AttemptState>(`/api/attempts/${attemptId}`);
      if (s.status !== "in_progress") {
        leaving.current = true;
        storePending(attemptId, {});
        router.replace(s.status === "abandoned" ? "/avaliacao" : `/resultado/${attemptId}`);
        return;
      }
      clockOffset.current = new Date(s.serverNow).getTime() - Date.now();
      const sel: Record<string, number | null> = {};
      for (const it of s.items) {
        sel[it.question.id] = it.response.optionIndex;
        times.current[it.question.id] = Math.max(times.current[it.question.id] ?? 0, it.response.timeSpentMs);
      }
      // Reaplica respostas que não chegaram ao servidor (queda de conexão / recarga).
      const saved = loadPending(attemptId);
      for (const [qid, p] of Object.entries(saved)) {
        if (qid in sel) {
          sel[qid] = p.optionIndex;
          times.current[qid] = Math.max(times.current[qid] ?? 0, p.timeSpentMs);
          pending.current[qid] = p;
        }
      }
      setSelections(sel);
      setMemory((m) => {
        const next = { ...m };
        for (const it of s.items) {
          if (it.question.memory && !next[it.question.id]) next[it.question.id] = it.question.memory.shown ? { kind: "answer" } : { kind: "intro" };
        }
        return next;
      });
      setState(s);
      const firstUnanswered = s.items.findIndex((it) => sel[it.question.id] === null || sel[it.question.id] === undefined);
      setCurrent((c) => (c === 0 && firstUnanswered > 0 ? firstUnanswered : c));
      if (Object.keys(pending.current).length) void flush();
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Não foi possível carregar a avaliação. Verifique sua conexão.");
    }
  }, [attemptId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // ------------------------------------------------------------ envio de respostas
  const flush = useCallback((): Promise<boolean> => {
    // Um envio por vez; chamadas concorrentes aguardam o envio em curso e reenviam o que restou.
    if (flushing.current) {
      return flushing.current.then(() => (Object.keys(pending.current).length ? flushRef.current() : true));
    }
    const run = (async (): Promise<boolean> => {
      // Cede antes de começar, para que `flushing.current` já aponte para esta execução no `finally`.
      await Promise.resolve();
      try {
        while (Object.keys(pending.current).length) {
          const [qid, payload] = Object.entries(pending.current)[0];
          setSaveStatus("saving");
          try {
            await api(`/api/attempts/${attemptId}/responses`, {
              method: "PUT",
              body: { questionId: qid, optionIndex: payload.optionIndex, timeSpentMs: Math.round(payload.timeSpentMs) },
            });
            if (pending.current[qid] === payload) delete pending.current[qid];
            storePending(attemptId, pending.current);
            retryDelay.current = 2000;
          } catch (e) {
            if (e instanceof ApiError && e.status !== 0 && e.status < 500 && e.status !== 429) {
              delete pending.current[qid];
              storePending(attemptId, pending.current);
              if (e.code === "attempt_closed" || e.code === "attempt_expired") {
                leaving.current = true;
                storePending(attemptId, {});
                router.replace(`/resultado/${attemptId}`);
                return false;
              }
              setSaveStatus("error");
              setActionError(e.message);
              continue;
            }
            setSaveStatus("offline");
            if (retryTimer.current) clearTimeout(retryTimer.current);
            retryTimer.current = setTimeout(() => void flush(), retryDelay.current);
            retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
            return false;
          }
        }
        setSaveStatus("saved");
        return true;
      } finally {
        flushing.current = null;
      }
    })();
    flushing.current = run;
    return run;
  }, [attemptId, router]);
  flushRef.current = flush;

  useEffect(() => {
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [flush]);

  const items = state?.items ?? [];
  const item = items[current];
  const question: PublicQuestion | undefined = item ? (questionsOverride[item.question.id] ?? item.question) : undefined;
  const memPhase = question?.memory ? memory[question.id] : undefined;
  const answerable = Boolean(question && (!question.memory || memPhase?.kind === "answer"));

  /** Acumula o tempo da questão atual e agenda o envio. */
  const commitTime = useCallback(
    (forceSave = false) => {
      if (!question) return;
      const elapsed = Date.now() - viewStart.current;
      viewStart.current = Date.now();
      if (!answerable) return;
      times.current[question.id] = (times.current[question.id] ?? 0) + elapsed;
      if (elapsed > 1500 || forceSave) {
        pending.current[question.id] = { optionIndex: selections[question.id] ?? null, timeSpentMs: times.current[question.id] };
        storePending(attemptId, pending.current);
        void flush();
      }
    },
    [answerable, attemptId, flush, question, selections],
  );

  function choose(index: number) {
    if (!question || !answerable) return;
    const elapsed = Date.now() - viewStart.current;
    viewStart.current = Date.now();
    times.current[question.id] = (times.current[question.id] ?? 0) + elapsed;
    setSelections((s) => ({ ...s, [question.id]: index }));
    pending.current[question.id] = { optionIndex: index, timeSpentMs: times.current[question.id] };
    storePending(attemptId, pending.current);
    void flush();
  }

  function go(to: number) {
    if (to < 0 || to >= items.length) return;
    setShowNav(false);
    if (to === current) return;
    commitTime();
    setCurrent(to);
    setShowNav(false);
  }

  // Foco no enunciado ao trocar de questão (leitores de tela e teclado).
  useEffect(() => {
    viewStart.current = Date.now();
    headingRef.current?.focus({ preventScroll: false });
  }, [current]);

  // Pausa a contagem de tempo por questão quando a aba fica oculta.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") commitTime(true);
      else viewStart.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [commitTime]);

  // Confirmação antes de sair da página com a avaliação em andamento.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current || !state) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  // ------------------------------------------------------------ cronômetro
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remainingMs = state ? new Date(state.deadlineAt).getTime() - (now + clockOffset.current) : 0;

  const complete = useCallback(
    async (auto = false) => {
      setFinishing(true);
      setActionError(null);
      commitTime(true);
      const ok = await flush();
      if (!ok && Object.keys(pending.current).length && !auto) {
        setFinishing(false);
        setActionError("Algumas respostas ainda não foram salvas. Verifique sua conexão e tente novamente.");
        return;
      }
      try {
        await api(`/api/attempts/${attemptId}/complete`, { method: "POST" });
        leaving.current = true;
        storePending(attemptId, {});
        router.replace(`/resultado/${attemptId}`);
      } catch (e) {
        setFinishing(false);
        setActionError(e instanceof ApiError ? e.message : "Não foi possível encerrar. Tente novamente.");
      }
    },
    [attemptId, commitTime, flush, router],
  );

  useEffect(() => {
    if (state && remainingMs <= 0 && !autoFinished.current) {
      autoFinished.current = true;
      void complete(true);
    }
  }, [complete, remainingMs, state]);

  // ------------------------------------------------------------ memória
  async function revealMemory() {
    if (!question) return;
    setActionError(null);
    try {
      const r = await api<{ stimulus: string; exposureSeconds: number; question: PublicQuestion }>(`/api/attempts/${attemptId}/stimulus`, {
        method: "POST",
        body: { questionId: question.id },
      });
      setQuestionsOverride((o) => ({ ...o, [question.id]: r.question }));
      const total = r.exposureSeconds * 1000;
      setMemory((m) => ({ ...m, [question.id]: { kind: "showing", text: r.stimulus, endsAt: Date.now() + total, total } }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "stimulus_already_shown") {
        await load();
        setMemory((m) => ({ ...m, [question.id]: { kind: "answer" } }));
      } else {
        setActionError(e instanceof ApiError ? e.message : "Falha de conexão ao exibir o conteúdo. Tente novamente.");
      }
    }
  }

  useEffect(() => {
    if (memPhase?.kind !== "showing" || !question) return;
    const ms = memPhase.endsAt - Date.now();
    const t = setTimeout(() => {
      setMemory((m) => ({ ...m, [question.id]: { kind: "answer" } }));
      viewStart.current = Date.now();
    }, Math.max(0, ms));
    return () => clearTimeout(t);
  }, [memPhase, question]);

  // ------------------------------------------------------------ atalhos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!question || !answerable || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("dialog, input[type=text], textarea")) return;
      const k = e.key.toUpperCase();
      const idx = "ABCDEF".indexOf(k) >= 0 ? "ABCDEF".indexOf(k) : "123456".indexOf(k);
      if (k.length === 1 && idx >= 0 && idx < question.options.length) {
        e.preventDefault();
        choose(idx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const answeredCount = useMemo(() => Object.values(selections).filter((v) => v !== null && v !== undefined).length, [selections]);

  // ------------------------------------------------------------ render
  if (loadError) {
    return (
      <div className="container max-w-xl py-24 text-center">
        <h1 className="font-display text-4xl">Não foi possível abrir a avaliação</h1>
        <p className="mt-3 text-muted">{loadError}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => { setLoadError(null); void load(); }}>Tentar novamente</Button>
          <Link href="/avaliacao" className="inline-flex h-11 items-center rounded-xl border border-line px-5">Voltar</Link>
        </div>
      </div>
    );
  }

  if (!state || !question || !item) {
    return (
      <div className="container py-24 text-center text-muted" role="status">
        Carregando avaliação…
      </div>
    );
  }

  const total = items.length;
  const selected = selections[question.id];
  const isLast = current === total - 1;
  const unanswered = total - answeredCount;
  const lowTime = remainingMs < 5 * 60_000;
  const figureOptions = question.options.some((o) => o.figure);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Barra superior fixa */}
      <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/90 backdrop-blur">
        <div className="container flex h-14 items-center gap-3">
          <LogoMark className="size-6 shrink-0" />
          <p className="text-sm font-medium">
            Questão <span className="font-mono tabular-nums">{current + 1}</span>
            <span className="text-faint"> de {total}</span>
          </p>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <SaveIndicator status={saveStatus} />
            <p
              className={cn("rounded-lg px-2.5 py-1 font-mono text-sm tabular-nums", lowTime ? "bg-warn/15 text-warn" : "text-muted")}
              aria-label={`Tempo restante: ${formatClock(remainingMs)}`}
              role="timer"
            >
              <span aria-hidden>⏱ </span>
              {formatClock(remainingMs)}
            </p>
            <Button size="sm" variant="secondary" onClick={() => finishDialog.current?.showModal()}>
              Encerrar
            </Button>
          </div>
        </div>
        <div
          className="h-1 w-full bg-surface-2"
          role="progressbar"
          aria-label="Questões respondidas"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
          aria-valuetext={`${answeredCount} de ${total} respondidas`}
        >
          <div className="h-full bg-gradient-to-r from-accent to-violet transition-[width] duration-300" style={{ width: `${(100 * answeredCount) / total}%` }} />
        </div>
      </header>

      <main id="conteudo" className="container flex-1 py-8 sm:py-12">
        <div key={question.id} className="mx-auto max-w-3xl animate-fade-up">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-line px-2.5 py-0.5 text-muted">{question.categoryName}</span>
            <span className="text-faint">Tempo sugerido: ~{question.recommendedSeconds} s</span>
          </div>

          <h1 ref={headingRef} tabIndex={-1} className="sr-only">
            Questão {current + 1} de {total}
          </h1>

          {question.memory && memPhase?.kind === "intro" && (
            <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="mem-title">
              <h2 id="mem-title" className="font-display text-2xl">Item de memória de trabalho</h2>
              <p className="mt-3 text-muted">
                Ao clicar no botão, um conteúdo aparecerá por <strong className="text-ink">{question.memory.exposureSeconds} segundos</strong>,
                uma única vez. Depois ele será ocultado e a pergunta será exibida. Não faça anotações: o objetivo é avaliar a memória.
              </p>
              <p className="mt-2 text-sm text-faint">Se a página for recarregada durante a exibição, o conteúdo não será mostrado novamente.</p>
              <Button className="mt-6" onClick={revealMemory}>
                Mostrar conteúdo
              </Button>
            </section>
          )}

          {question.memory && memPhase?.kind === "showing" && (
            <MemoryStimulus text={memPhase.text} endsAt={memPhase.endsAt} total={memPhase.total} />
          )}

          {answerable && question.prompt && (
            <>
              <p className="whitespace-pre-line text-xl leading-relaxed text-ink sm:text-2xl">{question.prompt}</p>
              {question.memory && (
                <p className="mt-2 text-sm text-faint">O conteúdo de memória já foi exibido e não pode ser reapresentado.</p>
              )}
              {question.figure && (
                <div className="mt-8">
                  <QuestionFigure figure={question.figure} />
                </div>
              )}

              <fieldset className="mt-8">
                <legend className="sr-only">Alternativas da questão {current + 1}</legend>
                <div className={cn("grid gap-3", figureOptions ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1")}>
                  {question.options.map((o) => {
                    const checked = selected === o.index;
                    return (
                      <label
                        key={o.index}
                        className={cn(
                          "group relative flex cursor-pointer items-center gap-4 rounded-xl border bg-surface p-4 transition-[border-color,background-color,box-shadow] duration-150",
                          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                          checked ? "border-accent bg-accent/[0.08] shadow-glow" : "border-line hover:border-accent/50 hover:bg-surface-2",
                          figureOptions && "flex-col gap-2 p-3",
                        )}
                      >
                        <input
                          type="radio"
                          name={`q-${question.id}`}
                          value={o.index}
                          checked={checked}
                          onChange={() => choose(o.index)}
                          className="sr-only"
                          aria-keyshortcuts={`${o.label} ${o.index + 1}`}
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-lg border font-mono text-sm transition-colors",
                            checked ? "border-accent bg-accent text-accent-ink" : "border-line text-muted group-hover:text-ink",
                            figureOptions && "self-start",
                          )}
                        >
                          {o.label}
                        </span>
                        {o.figure ? (
                          <span className="block w-full max-w-[120px]">
                            <span className="sr-only">Alternativa {o.label}: </span>
                            <GlyphCell glyph={o.figure} className="aspect-square w-full" />
                          </span>
                        ) : (
                          <span className="text-base text-ink sm:text-lg">
                            <span className="sr-only">Alternativa {o.label}: </span>
                            {o.text}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <p className="mt-3 text-xs text-faint">Atalhos: teclas A–{question.options.at(-1)?.label} ou 1–{question.options.length} selecionam a alternativa. A resposta é salva automaticamente e pode ser alterada até o fim.</p>
            </>
          )}

          {actionError && (
            <p role="alert" className="mt-6 rounded-xl border border-bad/40 bg-bad/[0.07] p-3 text-sm text-bad">
              {actionError}
            </p>
          )}

          {/* Navegação */}
          <nav aria-label="Navegação entre questões" className="mt-10 flex items-center justify-between gap-3 border-t border-line/70 pt-6">
            <Button variant="ghost" onClick={() => go(current - 1)} disabled={current === 0}>
              ← Anterior
            </Button>
            <button
              type="button"
              onClick={() => setShowNav((s) => !s)}
              aria-expanded={showNav}
              aria-controls="question-grid"
              className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink"
            >
              {answeredCount}/{total} respondidas
            </button>
            {isLast ? (
              <Button onClick={() => { commitTime(); finishDialog.current?.showModal(); }}>Revisar e encerrar</Button>
            ) : (
              <Button onClick={() => go(current + 1)}>{selected !== null && selected !== undefined ? "Próxima →" : "Pular →"}</Button>
            )}
          </nav>

          {showNav && (
            <div id="question-grid" className="mt-4 rounded-2xl border border-line bg-surface p-4 animate-fade-up">
              <ol className="grid grid-cols-6 gap-2 sm:grid-cols-9">
                {items.map((it, i) => {
                  const ans = selections[it.question.id] !== null && selections[it.question.id] !== undefined;
                  return (
                    <li key={it.question.id}>
                      <button
                        type="button"
                        onClick={() => go(i)}
                        aria-current={i === current ? "step" : undefined}
                        aria-label={`Questão ${i + 1}${ans ? ", respondida" : ", sem resposta"}`}
                        className={cn(
                          "h-10 w-full rounded-lg border font-mono text-sm transition-colors",
                          ans ? "border-accent/40 bg-accent/15 text-ink" : "border-line text-muted hover:text-ink",
                          i === current && "ring-2 ring-accent",
                        )}
                      >
                        {i + 1}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <button type="button" onClick={() => abandonDialog.current?.showModal()} className="mt-4 text-sm text-bad hover:underline">
                Abandonar esta avaliação
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Diálogo de encerramento */}
      <dialog ref={finishDialog} aria-labelledby="finish-title" className="w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-0 text-ink">
        <div className="p-6">
          <h2 id="finish-title" className="font-display text-2xl">Encerrar a avaliação?</h2>
          <p className="mt-3 text-muted">
            Você respondeu <strong className="text-ink">{answeredCount}</strong> de {total} questões.
            {unanswered > 0 && <> As <strong className="text-ink">{unanswered}</strong> não respondidas contarão como não respondidas.</>} Depois de encerrar, não será possível alterar as respostas.
          </p>
          {actionError && <p role="alert" className="mt-3 text-sm text-bad">{actionError}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => finishDialog.current?.close()} disabled={finishing}>
              Continuar respondendo
            </Button>
            <Button onClick={() => void complete()} disabled={finishing}>
              {finishing ? "Encerrando…" : "Encerrar e ver resultado"}
            </Button>
          </div>
        </div>
      </dialog>

      <dialog ref={abandonDialog} aria-labelledby="abandon-title" className="w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-0 text-ink">
        <div className="p-6">
          <h2 id="abandon-title" className="font-display text-2xl">Abandonar a avaliação?</h2>
          <p className="mt-3 text-muted">Uma avaliação abandonada não gera resultado e não pode ser retomada. Se quiser apenas fazer uma pausa, feche a página: o progresso fica salvo até o fim do tempo.</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => abandonDialog.current?.close()}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await api(`/api/attempts/${attemptId}/abandon`, { method: "POST" });
                  leaving.current = true;
                  storePending(attemptId, {});
                  router.replace("/avaliacao");
                } catch (e) {
                  setActionError(e instanceof ApiError ? e.message : "Falha ao abandonar.");
                  abandonDialog.current?.close();
                }
              }}
            >
              Abandonar
            </Button>
          </div>
        </div>
      </dialog>

      <div aria-live="polite" className="sr-only">
        {saveStatus === "saved" ? "Resposta salva." : saveStatus === "offline" ? "Sem conexão. A resposta será enviada quando a conexão voltar." : ""}
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { text: string; cls: string }> = {
    idle: { text: "", cls: "" },
    saving: { text: "Salvando…", cls: "text-muted" },
    saved: { text: "Salvo", cls: "text-good" },
    offline: { text: "Sem conexão — tentando", cls: "text-warn" },
    error: { text: "Erro ao salvar", cls: "text-bad" },
  };
  const s = map[status];
  if (!s.text) return null;
  return <span className={cn("hidden text-xs sm:inline", s.cls)}>{status === "saved" ? "✓ " : ""}{s.text}</span>;
}

function MemoryStimulus({ text, endsAt, total }: { text: string; endsAt: number; total: number }) {
  const [left, setLeft] = useState(endsAt - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(endsAt - Date.now()), 100);
    return () => clearInterval(id);
  }, [endsAt]);
  return (
    <section aria-live="assertive" className="rounded-2xl border border-accent/40 bg-surface p-8 text-center shadow-glow">
      <p className="text-xs uppercase tracking-[0.2em] text-accent">Memorize</p>
      <p className="mt-6 select-none font-mono text-3xl tracking-[0.25em] text-ink sm:text-5xl" style={{ wordSpacing: "0.3em" }}>
        {text}
      </p>
      <div className="mx-auto mt-8 h-1.5 max-w-sm overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-100 ease-linear" style={{ width: `${Math.max(0, (100 * left) / total)}%` }} />
      </div>
      <p className="mt-2 font-mono text-sm text-muted">{Math.max(0, Math.ceil(left / 1000))} s</p>
    </section>
  );
}
