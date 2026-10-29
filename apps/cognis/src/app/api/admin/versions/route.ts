import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createTestVersion } from "@/lib/services/admin-content";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  enforceRateLimit(req, "admin");
  const admin = await requireAdmin();
  const body = await parseJson(req, z.record(z.string(), z.unknown()));
  await createTestVersion(admin.id, body);
  return json({ ok: true }, { status: 201 });
});
