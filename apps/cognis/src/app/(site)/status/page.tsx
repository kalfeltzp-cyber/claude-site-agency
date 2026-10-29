import type { Metadata } from "next";
import { diagnose } from "@/lib/diagnostics";
import { DiagnosisList } from "@/components/setup/diagnosis-list";
import { Notice, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Status da configuração", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const d = await diagnose();
  return (
    <div className="container max-w-3xl pb-16">
      <PageHeader eyebrow="Status" title={d.ok ? "Tudo configurado" : "Configuração incompleta"}>
        Verificação das variáveis de ambiente e do banco de dados. Nenhum segredo é exibido nesta página.
      </PageHeader>
      <div className="mt-8 space-y-6">
        <DiagnosisList diagnosis={d} />
        {!d.ok && (
          <Notice tone="warn" title="Depois de corrigir">
            Ao alterar variáveis na Vercel, faça <strong>Redeploy</strong> (Deployments → ⋯ → Redeploy) para que elas passem a valer, e recarregue esta página.
          </Notice>
        )}
      </div>
    </div>
  );
}
