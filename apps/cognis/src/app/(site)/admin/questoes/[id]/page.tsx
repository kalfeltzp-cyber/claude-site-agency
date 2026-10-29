import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminGuard } from "@/lib/auth/guard";
import { db } from "@/lib/db/pool";
import { getQuestionsByIds, listCategories } from "@/lib/services/content-repo";
import { AdminHeader } from "@/components/admin/admin-nav";
import { QuestionEditor } from "@/components/admin/question-editor";

export const metadata: Metadata = { title: "Admin · Editar questão", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await adminGuard(`/admin/questoes/${id}`);
  if (!/^[a-z]{2,4}-\d{3}$/.test(id)) notFound();
  const [questions, categories] = await Promise.all([getQuestionsByIds(db, [id]), listCategories(db, true)]);
  const question = questions.get(id);
  if (!question) notFound();
  return (
    <div className="container pb-16">
      <AdminHeader title={`Questão ${id}`} active="/admin/questoes" />
      <div className="mt-8">
        <QuestionEditor initial={question} categories={categories} />
      </div>
    </div>
  );
}
