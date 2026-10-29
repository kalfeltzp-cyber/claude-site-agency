import { getOwner } from "@/lib/auth/session";
import { finalizeAttempt } from "@/lib/services/assessment";
import { enforceRateLimit, handler, json } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  enforceRateLimit(req, "general");
  const { id } = await params;
  return json(await finalizeAttempt(id, await getOwner()));
});
