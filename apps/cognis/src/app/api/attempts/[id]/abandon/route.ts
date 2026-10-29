import { getOwner } from "@/lib/auth/session";
import { abandonAttempt } from "@/lib/services/assessment";
import { enforceRateLimit, handler, json } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  enforceRateLimit(req, "general");
  const { id } = await params;
  await abandonAttempt(id, await getOwner());
  return json({ ok: true });
});
