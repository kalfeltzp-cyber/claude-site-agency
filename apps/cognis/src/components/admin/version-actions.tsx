"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/button";
import { ApiError, api } from "../assessment/api";

export function ActivateVersion({ id }: { id: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          if (!confirm(`Ativar a versão ${id}? A versão atual será aposentada; tentativas em andamento continuam na versão original.`)) return;
          try {
            await api(`/api/admin/versions/${id}/activate`, { method: "POST" });
            router.refresh();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : "Falha ao ativar.");
          }
        }}
      >
        Ativar
      </Button>
      {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}
    </div>
  );
}

const input = "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

export function NewVersionForm({ template }: { template: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setMsg(null);
        try {
          const blueprint = JSON.parse(String(f.get("blueprint")));
          await api("/api/admin/versions", {
            method: "POST",
            body: { id: f.get("id"), name: f.get("name"), timeLimitSeconds: Number(f.get("time")) * 60, notes: f.get("notes") ?? "", blueprint },
          });
          setMsg({ ok: true, text: "Versão criada como rascunho." });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: err instanceof ApiError ? err.message : err instanceof SyntaxError ? "Matriz: JSON inválido." : "Falha ao criar." });
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-muted">Id<input name="id" required placeholder="v2" className={input} /></label>
        <label className="text-sm text-muted">Nome<input name="name" required className={input} /></label>
        <label className="text-sm text-muted">Limite (min)<input name="time" type="number" min={5} max={120} defaultValue={40} className={input} /></label>
      </div>
      <label className="text-sm text-muted">Notas<input name="notes" className={input} /></label>
      <label className="text-sm text-muted">Matriz (JSON)<textarea name="blueprint" rows={10} defaultValue={template} className={`${input} font-mono`} spellCheck={false} /></label>
      <div className="flex items-center gap-3">
        <Button size="sm" type="submit">Criar versão</Button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
