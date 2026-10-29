import { notFound, redirect } from "next/navigation";
import { getOwner } from "@/lib/auth/session";
import { getAttemptState, getResult } from "@/lib/services/assessment";
import { AppError } from "@/lib/security/errors";

/** Carrega o resultado do titular; tentativas em andamento voltam para a avaliação. */
export async function loadOwnResult(id: string) {
  const owner = await getOwner();
  try {
    return await getResult(id, owner, { includeItems: true });
  } catch (e) {
    if (e instanceof AppError && e.status === 404) {
      // Pode ser uma tentativa ainda sem resultado (em andamento) ou expirada sem finalizar.
      try {
        const state = await getAttemptState(id, owner);
        if (state.status === "in_progress") redirect(`/avaliacao/${id}`);
        if (state.status === "abandoned") redirect("/historico");
        return await getResult(id, owner, { includeItems: true });
      } catch (inner) {
        if (inner instanceof AppError) notFound();
        throw inner;
      }
    }
    throw e;
  }
}
