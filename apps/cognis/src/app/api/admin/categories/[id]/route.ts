import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { saveCategory } from "@/lib/services/admin-content";
import { badRequest } from "@/lib/security/errors";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export const PUT = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  enforceRateLimit(req, "admin");
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await parseJson(req, z.record(z.string(), z.unknown()));
  if (body.id !== id) throw badRequest("O id da categoria não confere.");
  await saveCategory(admin.id, body);
  return json({ ok: true });
});
