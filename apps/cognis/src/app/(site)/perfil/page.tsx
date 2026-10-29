import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listHistory } from "@/lib/services/assessment";
import { formatDate } from "@/lib/i18n";
import { Badge, Card, PageHeader, Stat } from "@/components/ui/card";
import { DeleteAccount, ProfileForm, SignOutButton } from "@/components/auth/profile-actions";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Perfil", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/perfil");
  const history = await listHistory({ userId: user.id, anonHash: null });
  const finished = history.filter((h) => h.performanceIndex !== null);

  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Perfil" title={user.displayName ? `Olá, ${user.displayName}` : "Sua conta"}>
        Gerencie seus dados, exporte suas informações ou exclua a conta.
      </PageHeader>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-2xl">Dados da conta</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-faint">E-mail</dt><dd className="mt-0.5 text-ink">{user.email}</dd></div>
              <div><dt className="text-faint">Conta criada em</dt><dd className="mt-0.5 text-ink">{formatDate(user.createdAt)}</dd></div>
              <div><dt className="text-faint">Perfil</dt><dd className="mt-0.5"><Badge tone={user.role === "admin" ? "violet" : "neutral"}>{user.role === "admin" ? "Administrador" : "Participante"}</Badge></dd></div>
            </dl>
            <div className="mt-6 max-w-sm"><ProfileForm displayName={user.displayName} /></div>
          </Card>
          <Card className="p-6">
            <h2 className="font-display text-2xl">Seus dados (LGPD)</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Você pode baixar uma cópia de todos os dados associados à sua conta (portabilidade) ou excluí-los definitivamente.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/api/account/export" className={buttonClass("secondary")} download>Baixar meus dados (JSON)</a>
              <DeleteAccount />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Avaliações" value={history.length} />
            <Stat label="Concluídas" value={finished.length} />
          </div>
          <Card className="p-6">
            <h2 className="font-display text-2xl">Sessão</h2>
            <p className="mb-4 mt-2 text-sm text-muted">Encerre a sessão neste dispositivo.</p>
            <SignOutButton />
          </Card>
        </div>
      </div>
    </div>
  );
}
