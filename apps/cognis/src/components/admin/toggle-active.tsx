"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "../assessment/api";

export function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={`${active ? "Desativar" : "Ativar"} questão ${id}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/admin/questions/${id}`, { method: "PATCH", body: { active: !active } });
          router.refresh();
        } catch (e) {
          alert(e instanceof ApiError ? e.message : "Falha ao alterar.");
        } finally {
          setBusy(false);
        }
      }}
      className={`relative h-6 w-11 rounded-full transition-colors ${active ? "bg-good" : "bg-surface-2 border border-line"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}
