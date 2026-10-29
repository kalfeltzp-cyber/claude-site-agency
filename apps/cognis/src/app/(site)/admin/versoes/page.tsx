import type { Metadata } from "next";
import { adminGuard } from "@/lib/auth/guard";
import { db } from "@/lib/db/pool";
import { listTestVersions } from "@/lib/services/content-repo";
import { blueprintSize } from "@/lib/engine/selection";
import { formatDate } from "@/lib/i18n";
import { AdminHeader } from "@/components/admin/admin-nav";
import { ActivateVersion, NewVersionForm } from "@/components/admin/version-actions";
import { Badge, Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin · Versões", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminVersionsPage() {
  await adminGuard("/admin/versoes");
  const versions = await listTestVersions(db);
  const active = versions.find((v) => v.status === "active");
  return (
    <div className="container pb-16">
      <AdminHeader title="Versões da avaliação" active="/admin/versoes" />
      <p className="mt-6 max-w-3xl text-sm text-muted">
        Cada tentativa fica vinculada à versão ativa no momento em que começou. Estatísticas e eventuais normas devem ser calculadas
        por versão; mudar a matriz cria uma nova versão em vez de editar a anterior.
      </p>
      <div className="mt-6 space-y-4">
        {versions.map((v) => (
          <Card key={v.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{v.name} <span className="font-mono text-sm text-faint">({v.id})</span></p>
                <p className="mt-1 text-sm text-muted">
                  {blueprintSize(v.blueprint)} itens · {Math.round(v.timeLimitSeconds / 60)} min · criada em {formatDate(v.createdAt)}
                  {v.activatedAt && ` · ativada em ${formatDate(v.activatedAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={v.status === "active" ? "good" : v.status === "draft" ? "warn" : "neutral"}>{v.status}</Badge>
                {v.status !== "active" && <ActivateVersion id={v.id} />}
              </div>
            </div>
            {v.notes && <p className="mt-3 text-sm text-muted">{v.notes}</p>}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted">Matriz</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs">{JSON.stringify(v.blueprint, null, 2)}</pre>
            </details>
          </Card>
        ))}
      </div>
      <Card className="mt-8 p-6">
        <h2 className="font-display text-2xl">Nova versão (rascunho)</h2>
        <p className="mb-4 mt-1 text-sm text-muted">A matriz é validada contra o banco ativo antes de ser salva.</p>
        <NewVersionForm template={JSON.stringify(active?.blueprint ?? { cells: [] }, null, 2)} />
      </Card>
    </div>
  );
}
