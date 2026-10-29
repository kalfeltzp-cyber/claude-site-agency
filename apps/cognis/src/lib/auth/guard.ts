import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import type { SessionUser } from "./users";

/** Proteção de páginas administrativas: verificada no servidor a cada requisição. */
export async function adminGuard(path: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(path)}`);
  // Não revela a existência do painel a usuários comuns.
  if (user.role !== "admin") notFound();
  return user;
}
