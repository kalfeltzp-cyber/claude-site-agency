import { z } from "zod";
import { getOwner } from "@/lib/auth/session";
import { startAttempt } from "@/lib/services/assessment";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";

export const dynamic = "force-dynamic";

const body = z.object({ consent: z.literal(true) }).strict();

export const POST = handler(async (req) => {
  enforceRateLimit(req, "startAttempt");
  const { consent } = await parseJson(req, body);
  const owner = await getOwner({ createAnon: true });
  const result = await startAttempt(owner, { consent });
  return json(result, { status: result.resumed ? 200 : 201 });
});
