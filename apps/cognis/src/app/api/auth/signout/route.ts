import { signOut } from "@/lib/auth/session";
import { handler, json } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  await signOut();
  return json({ ok: true });
});
