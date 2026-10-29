import type { Metadata } from "next";
import { AssessmentRunner } from "@/components/assessment/runner";

export const metadata: Metadata = { title: "Avaliação em andamento", robots: { index: false, follow: false } };

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssessmentRunner attemptId={id} />;
}
