import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, Notice } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Entrar ou criar conta",
  description: "Crie uma conta no Cognis para guardar o histórico das suas avaliações.",
  alternates: { canonical: "/entrar" },
};
export const dynamic = "force-dynamic";

function safeNext(v: string | undefined): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/perfil";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ modo?: string; next?: string; erro?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="container grid min-h-[70vh] items-center gap-12 py-12 lg:grid-cols-2">
      <section className="max-w-lg">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Conta</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Guarde seu histórico de avaliações</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          A conta é opcional. Com ela, seus resultados ficam disponíveis em qualquer dispositivo e você acompanha a evolução entre tentativas.
          Coletamos apenas e-mail, senha (armazenada com hash) e, se quiser, um nome de exibição.
        </p>
      </section>
      <Card className="w-full max-w-md justify-self-center p-6 sm:p-8">
        {sp.erro === "confirmacao" && (
          <Notice tone="bad" className="mb-5">O link de confirmação é inválido ou expirou. Tente entrar ou crie a conta novamente.</Notice>
        )}
        <AuthForm initialMode={sp.modo === "cadastro" ? "cadastro" : "entrar"} next={next} />
      </Card>
    </div>
  );
}
