import { z } from "zod";
import { getOwner } from "@/lib/auth/session";
import { revealStimulus } from "@/lib/services/assessment";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";

export const dynamic = "force-dynamic";

const body = z.object({ questionId: z.string().regex(/^[a-z]{2,4}-\d{3}$/) }).strict();

export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  enforceRateLimit(req, "answer");
  const { id } = await params;
  const { questionId } = await parseJson(req, body);
  return json(await revealStimulus(id, await getOwner(), questionId));
});
