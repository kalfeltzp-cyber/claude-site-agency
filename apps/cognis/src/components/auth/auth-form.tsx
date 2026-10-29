"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { ApiError, api } from "../assessment/api";

const field = "mt-1.5 block h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink placeholder:text-faint focus:border-accent focus:outline-none";

export function AuthForm({ initialMode, next }: { initialMode: "entrar" | "cadastro"; next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (mode === "entrar") {
        await api("/api/auth/signin", { method: "POST", body: { email: form.get("email"), password: form.get("password") } });
      } else {
        if (form.get("password") !== form.get("confirm")) throw new ApiError(422, "mismatch", "As senhas não coincidem.");
        const r = await api<{ status: string }>("/api/auth/signup", {
          method: "POST",
          body: {
            email: form.get("email"),
            password: form.get("password"),
            displayName: form.get("displayName") || undefined,
            acceptPrivacy: form.get("acceptPrivacy") === "on",
          },
        });
        if (r.status === "confirmation_required") {
          setInfo("Conta criada. Enviamos um link de confirmação para o seu e-mail; depois de confirmar, entre normalmente.");
          setBusy(false);
          return;
        }
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Acesso" className="grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1">
        {(["entrar", "cadastro"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            aria-controls="auth-panel"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn("h-10 rounded-lg text-sm font-medium transition-colors", mode === m ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}
          >
            {m === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      <form id="auth-panel" role="tabpanel" onSubmit={onSubmit} className="mt-6 space-y-4" noValidate={false}>
        {mode === "cadastro" && (
          <label className="block text-sm text-muted">
            Nome de exibição <span className="text-faint">(opcional)</span>
            <input name="displayName" maxLength={80} autoComplete="nickname" className={field} />
          </label>
        )}
        <label className="block text-sm text-muted">
          E-mail
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="block text-sm text-muted">
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={mode === "cadastro" ? 10 : 1}
            autoComplete={mode === "cadastro" ? "new-password" : "current-password"}
            aria-describedby={mode === "cadastro" ? "pw-hint" : undefined}
            className={field}
          />
        </label>
        {mode === "cadastro" && (
          <>
            <p id="pw-hint" className="-mt-2 text-xs text-faint">Mínimo de 10 caracteres, combinando letras e números.</p>
            <label className="block text-sm text-muted">
              Confirme a senha
              <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={field} />
            </label>
            <label className="flex items-start gap-3 text-sm text-muted">
              <input type="checkbox" name="acceptPrivacy" required className="mt-1 size-4 accent-[rgb(var(--accent))]" />
              <span>
                Li e aceito a <Link href="/privacidade" className="text-accent underline">política de privacidade</Link>. Posso excluir minha conta e meus dados a qualquer momento.
              </span>
            </label>
          </>
        )}
        {error && <p role="alert" className="rounded-lg border border-bad/40 bg-bad/[0.07] p-3 text-sm text-bad">{error}</p>}
        {info && <p role="status" className="rounded-lg border border-good/40 bg-good/[0.07] p-3 text-sm text-good">{info}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
    </div>
  );
}
