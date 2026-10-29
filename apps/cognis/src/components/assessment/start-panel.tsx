"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClass } from "../ui/button";
import { ApiError, api } from "./api";

export function StartPanel({ activeAttemptId }: { activeAttemptId: string | null }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ attemptId: string }>("/api/attempts", { method: "POST", body: { consent: true } });
      router.push(`/avaliacao/${r.attemptId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível iniciar.");
      setBusy(false);
    }
  }

  async function restart() {
    if (!activeAttemptId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/attempts/${activeAttemptId}/abandon`, { method: "POST" });
      router.refresh();
      setBusy(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível abandonar a avaliação anterior.");
      setBusy(false);
    }
  }

  if (activeAttemptId) {
    return (
      <div className="space-y-4">
        <p className="text-muted">Você tem uma avaliação em andamento. Suas respostas foram salvas e o tempo continua contando a partir do início.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/avaliacao/${activeAttemptId}`} className={buttonClass("primary", "lg")}>
            Continuar avaliação
          </Link>
          <Button variant="secondary" size="lg" onClick={restart} disabled={busy}>
            Abandonar e começar outra
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-4 text-sm leading-relaxed text-muted has-[:checked]:border-accent/60">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[rgb(var(--accent))]" />
        <span>
          Entendo que esta é uma <strong className="text-ink">avaliação experimental</strong>, que o resultado não é um QI clínico nem
          diagnóstico, e concordo com o tratamento das minhas respostas conforme a{" "}
          <Link href="/privacidade" className="text-accent underline underline-offset-2">política de privacidade</Link>.
        </span>
      </label>
      <Button size="lg" onClick={start} disabled={!consent || busy} className="w-full sm:w-auto">
        {busy ? "Preparando questões…" : "Iniciar avaliação"}
      </Button>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
