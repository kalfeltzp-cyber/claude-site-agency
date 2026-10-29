import { requireAdmin } from "@/lib/auth/session";
import { activateVersion } from "@/lib/services/admin-content";
import { enforceRateLimit, handler, json } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  enforceRateLimit(req, "admin");
  const admin = await requireAdmin();
  const { id } = await params;
  await activateVersion(admin.id, id);
  return json({ ok: true });
});
