"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { ApiError, api } from "../assessment/api";

const field = "mt-1.5 block h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink focus:border-accent focus:outline-none";

export function ProfileForm({ displayName }: { displayName: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const name = String(new FormData(e.currentTarget).get("displayName") ?? "");
        try {
          await api("/api/account", { method: "PATCH", body: { displayName: name } });
          setMsg({ ok: true, text: "Nome atualizado." });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Falha ao salvar." });
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm text-muted">
        Nome de exibição
        <input name="displayName" defaultValue={displayName ?? ""} maxLength={80} className={field} />
      </label>
      <Button type="submit" disabled={busy}>Salvar</Button>
      {msg && <p role="status" className={msg.ok ? "text-sm text-good" : "text-sm text-bad"}>{msg.text}</p>}
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await api("/api/auth/signout", { method: "POST" }).catch(() => undefined);
        router.replace("/");
        router.refresh();
      }}
    >
      Sair da conta
    </Button>
  );
}

export function DeleteAccount() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => dialog.current?.showModal()}>Excluir conta e dados</Button>
      <dialog ref={dialog} aria-labelledby="del-title" className="w-[min(92vw,480px)] rounded-2xl border border-line bg-surface p-0 text-ink">
        <form
          className="p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api("/api/account", { method: "DELETE", body: { confirm } });
              router.replace("/?conta=excluida");
              router.refresh();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Falha ao excluir.");
              setBusy(false);
            }
          }}
        >
          <h2 id="del-title" className="font-display text-2xl">Excluir conta definitivamente?</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Serão apagados permanentemente: sua conta, perfil, todas as tentativas, respostas e resultados. Estatísticas agregadas já
            calculadas não contêm seus dados pessoais. Esta ação não pode ser desfeita.
          </p>
          <label className="mt-4 block text-sm text-muted">
            Digite <strong className="font-mono text-ink">EXCLUIR</strong> para confirmar
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} autoComplete="off" />
          </label>
          {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>Cancelar</Button>
            <Button type="submit" variant="danger" disabled={confirm !== "EXCLUIR" || busy}>{busy ? "Excluindo…" : "Excluir definitivamente"}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
