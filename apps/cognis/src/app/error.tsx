"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="conteudo" className="container flex min-h-[80vh] flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-sm text-bad">Erro</p>
      <h1 className="mt-3 font-display text-5xl">Algo não saiu como esperado</h1>
      <p className="mt-4 max-w-md text-muted">
        Ocorreu um erro ao carregar esta página. Seu progresso em avaliações é salvo no servidor a cada resposta.
        {error.digest && <span className="mt-2 block font-mono text-xs text-faint">Código: {error.digest}</span>}
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <ButtonLink href="/" variant="secondary">
          Página inicial
        </ButtonLink>
        <ButtonLink href="/status" variant="ghost">
          Ver diagnóstico
        </ButtonLink>
      </div>
    </main>
  );
}
