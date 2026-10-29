"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category } from "@/lib/questions/schema";
import { Button } from "../ui/button";
import { ApiError, api } from "../assessment/api";

const input = "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";

export function CategoryForm({ category }: { category: Category }) {
  const router = useRouter();
  const [c, setC] = useState(category);
  const [practice, setPractice] = useState(category.practice.join("\n"));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await api(`/api/admin/categories/${c.id}`, {
            method: "PUT",
            body: { ...c, practice: practice.split("\n").map((s) => s.trim()).filter(Boolean) },
          });
          setMsg({ ok: true, text: "Salvo." });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Falha ao salvar." });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
        <label className="text-sm text-muted">Nome<input className={input} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></label>
        <label className="text-sm text-muted">Ordem<input type="number" className={input} value={c.sortOrder} onChange={(e) => setC({ ...c, sortOrder: Number(e.target.value) })} /></label>
        <label className="flex items-center gap-2 pt-6 text-sm text-muted"><input type="checkbox" checked={c.active} onChange={(e) => setC({ ...c, active: e.target.checked })} className="size-4" /> Ativa</label>
      </div>
      <label className="text-sm text-muted">Descrição<textarea rows={2} className={input} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} /></label>
      <label className="text-sm text-muted">Construto<input className={input} value={c.construct} onChange={(e) => setC({ ...c, construct: e.target.value })} /></label>
      <label className="text-sm text-muted">Sugestões de prática (uma por linha)<textarea rows={3} className={input} value={practice} onChange={(e) => setPractice(e.target.value)} /></label>
      <div className="flex items-center gap-3">
        <Button size="sm" type="submit" disabled={busy}>Salvar</Button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
