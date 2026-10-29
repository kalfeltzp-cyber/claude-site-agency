import { signIn } from "@/lib/auth/session";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";
import { credentialsSchema } from "../schemas";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const input = await parseJson(req, credentialsSchema);
  enforceRateLimit(req, "auth", input.email.toLowerCase());
  await signIn(input.email, input.password);
  return json({ ok: true });
});
