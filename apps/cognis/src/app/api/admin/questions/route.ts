import { requireAdmin } from "@/lib/auth/session";
import { saveQuestion } from "@/lib/services/admin-content";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  enforceRateLimit(req, "admin");
  const admin = await requireAdmin();
  const body = await parseJson(req, z.record(z.string(), z.unknown()));
  const q = await saveQuestion(admin.id, body, "create");
  return json({ id: q.id, version: q.version }, { status: 201 });
});
