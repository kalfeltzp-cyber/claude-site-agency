import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="container flex min-h-[80vh] flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-3 font-display text-5xl">Página não encontrada</h1>
      <p className="mt-4 max-w-md text-muted">O endereço pode ter sido digitado incorretamente, ou o conteúdo não existe ou não pertence à sua sessão.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/">Página inicial</ButtonLink>
        <ButtonLink href="/avaliacao" variant="secondary">
          Começar avaliação
        </ButtonLink>
      </div>
    </main>
  );
}
