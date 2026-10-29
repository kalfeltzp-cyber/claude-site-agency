import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { saveQuestion, toggleQuestion } from "@/lib/services/admin-content";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler<Ctx>(async (req, { params }) => {
  enforceRateLimit(req, "admin");
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await parseJson(req, z.record(z.string(), z.unknown()));
  const q = await saveQuestion(admin.id, body, "update", id);
  return json({ id: q.id, version: q.version });
});

export const PATCH = handler<Ctx>(async (req, { params }) => {
  enforceRateLimit(req, "admin");
  const admin = await requireAdmin();
  const { id } = await params;
  const { active } = await parseJson(req, z.object({ active: z.boolean() }).strict());
  await toggleQuestion(admin.id, id, active);
  return json({ ok: true });
});
