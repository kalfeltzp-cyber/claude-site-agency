import { z } from "zod";
import { deleteAccount, requireUser } from "@/lib/auth/session";
import { updateDisplayName } from "@/lib/auth/users";
import { enforceRateLimit, handler, json, parseJson } from "@/lib/security/http";

export const dynamic = "force-dynamic";

const patch = z.object({ displayName: z.string().trim().max(80).transform((v) => v || null) }).strict();
const del = z.object({ confirm: z.literal("EXCLUIR") }).strict();

export const PATCH = handler(async (req) => {
  enforceRateLimit(req, "general");
  const user = await requireUser();
  const { displayName } = await parseJson(req, patch);
  await updateDisplayName(user.id, displayName);
  return json({ ok: true });
});

export const DELETE = handler(async (req) => {
  enforceRateLimit(req, "auth");
  const user = await requireUser();
  await parseJson(req, del);
  await deleteAccount(user.id);
  return json({ ok: true });
});
