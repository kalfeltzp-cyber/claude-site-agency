import { z } from "zod";
import { getOwner } from "@/lib/auth/session";
import { saveResponse } from "@/lib/services/assessment";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";

export const dynamic = "force-dynamic";

const body = z
  .object({
    questionId: z.string().regex(/^[a-z]{2,4}-\d{3}$/),
    optionIndex: z.number().int().min(0).max(5).nullable(),
    timeSpentMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  })
  .strict();

export const PUT = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  enforceRateLimit(req, "answer");
  const { id } = await params;
  const input = await parseJson(req, body);
  return json(await saveResponse(id, await getOwner(), input));
});
