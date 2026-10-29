import { getOwner } from "@/lib/auth/session";
import { createShareLink, revokeShareLink } from "@/lib/services/assessment";
import { enforceRateLimit, handler, json } from "@/lib/security/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (req, { params }) => {
  enforceRateLimit(req, "general");
  const { id } = await params;
  const { token } = await createShareLink(id, await getOwner());
  return json({ path: `/r/${token}` }, { status: 201 });
});

export const DELETE = handler<Ctx>(async (req, { params }) => {
  enforceRateLimit(req, "general");
  const { id } = await params;
  await revokeShareLink(id, await getOwner());
  return json({ ok: true });
});
