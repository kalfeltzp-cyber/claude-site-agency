import type { Metadata } from "next";
import { adminGuard } from "@/lib/auth/guard";
import { db } from "@/lib/db/pool";
import { listCategories } from "@/lib/services/content-repo";
import { AdminHeader } from "@/components/admin/admin-nav";
import { CategoryForm } from "@/components/admin/category-form";
import { Card, Notice } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin · Categorias", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await adminGuard("/admin/categorias");
  const categories = await listCategories(db, true);
  return (
    <div className="container pb-16">
      <AdminHeader title="Categorias" active="/admin/categorias" />
      <Notice className="mt-6" tone="warn">
        Desativar uma categoria remove suas questões do sorteio. Se a versão ativa exigir essa categoria, novas avaliações não poderão
        ser iniciadas até que a matriz seja ajustada.
      </Notice>
      <div className="mt-6 space-y-4">
        {categories.map((c) => (
          <Card key={c.id} className="p-5">
            <p className="mb-3 font-mono text-xs text-faint">{c.id}</p>
            <CategoryForm category={c} />
          </Card>
        ))}
      </div>
    </div>
  );
}
