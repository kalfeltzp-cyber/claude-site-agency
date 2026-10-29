"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { ApiError, api } from "../assessment/api";

export function ShareButton({ attemptId, initiallyShared }: { attemptId: string; initiallyShared: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [shared, setShared] = useState(initiallyShared);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ path: string }>(`/api/attempts/${attemptId}/share`, { method: "POST" });
      const full = `${window.location.origin}${r.path}`;
      setUrl(full);
      setShared(true);
      if (navigator.share) {
        await navigator.share({ title: "Meu resultado no Cognis", url: full }).catch(() => undefined);
      } else {
        await navigator.clipboard?.writeText(full).then(
          () => setMsg("Link copiado."),
          () => undefined,
        );
      }
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Não foi possível criar o link.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await api(`/api/attempts/${attemptId}/share`, { method: "DELETE" });
      setShared(false);
      setUrl(null);
      setMsg("Link desativado. Quem tinha o endereço não consegue mais acessá-lo.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Falha ao desativar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={create} disabled={busy}>
          {shared ? "Gerar novo link" : "Compartilhar"}
        </Button>
        {shared && (
          <Button variant="ghost" onClick={revoke} disabled={busy}>
            Desativar link
          </Button>
        )}
      </div>
      {url && (
        <div className="flex max-w-md items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <input readOnly value={url} aria-label="Link de compartilhamento" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink outline-none" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="text-xs text-accent" onClick={() => navigator.clipboard?.writeText(url).then(() => setMsg("Link copiado."))}>
            Copiar
          </button>
        </div>
      )}
      <p className="text-xs text-faint">O link mostra apenas o resumo do resultado, sem seu nome, e-mail ou respostas.</p>
      {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
