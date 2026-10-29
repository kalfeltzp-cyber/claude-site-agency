import type { Metadata } from "next";
import { adminGuard } from "@/lib/auth/guard";
import { db } from "@/lib/db/pool";
import { listCategories } from "@/lib/services/content-repo";
import { AdminHeader } from "@/components/admin/admin-nav";
import { QuestionEditor } from "@/components/admin/question-editor";

export const metadata: Metadata = { title: "Admin · Nova questão", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewQuestionPage() {
  await adminGuard("/admin/questoes/nova");
  const categories = await listCategories(db, true);
  return (
    <div className="container pb-16">
      <AdminHeader title="Nova questão" active="/admin/questoes" />
      <div className="mt-8">
        <QuestionEditor initial={null} categories={categories} />
      </div>
    </div>
  );
}
