import { getCurrentUser } from "@/lib/auth/session";
import { json } from "@/lib/security/http";

export const dynamic = "force-dynamic";

/** Estado mínimo da sessão para o cabeçalho (sem e-mail ou id). */
export async function GET() {
  const user = await getCurrentUser();
  return json(user ? { signedIn: true, displayName: user.displayName, isAdmin: user.role === "admin" } : { signedIn: false, displayName: null, isAdmin: false });
}
