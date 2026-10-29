import { signUp } from "@/lib/auth/session";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";
import { signupSchema } from "../schemas";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  enforceRateLimit(req, "auth");
  const input = await parseJson(req, signupSchema);
  const result = await signUp({ email: input.email, password: input.password, displayName: input.displayName });
  return json(result, { status: 201 });
});
