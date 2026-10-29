import type { Metadata } from "next";
import { adminGuard } from "@/lib/auth/guard";
import { db } from "@/lib/db/pool";
import { listReferences } from "@/lib/services/content-repo";
import { AdminHeader } from "@/components/admin/admin-nav";
import { Card, Notice } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin · Referências", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminReferencesPage() {
  await adminGuard("/admin/referencias");
  const refs = await listReferences(db);
  return (
    <div className="container pb-16">
      <AdminHeader title="Referências científicas" active="/admin/referencias" />
      <Notice className="mt-6">
        As referências são versionadas em <code className="font-mono">data/references.json</code> e sincronizadas com{" "}
        <code className="font-mono">npm run db:seed</code>, para que toda alteração passe por revisão de código. Antes de adicionar
        uma fonte, confirme autores, ano, periódico e DOI na publicação original.
      </Notice>
      <Card className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <caption className="sr-only">Referências cadastradas</caption>
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Id</th>
                <th scope="col" className="px-4 py-3 font-medium">Referência</th>
                <th scope="col" className="px-4 py-3 font-medium">Tema</th>
                <th scope="col" className="px-4 py-3 font-medium">Uso</th>
              </tr>
            </thead>
            <tbody>
              {refs.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-3">
                    {r.authors} ({r.year}). <em>{r.title}</em>.{" "}
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{r.doi ?? "link"}</a>
                  </td>
                  <td className="px-4 py-3 text-muted">{r.topic}</td>
                  <td className="px-4 py-3 text-muted">{r.usedFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
