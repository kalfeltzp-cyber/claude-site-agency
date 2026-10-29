import { requireUser } from "@/lib/auth/session";
import { exportOwnData } from "@/lib/services/assessment";
import { enforceRateLimit, handler } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  enforceRateLimit(req, "general");
  const user = await requireUser();
  const data = await exportOwnData(user.id);
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt },
      ...data,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cognis-meus-dados.json"',
      "Cache-Control": "no-store",
    },
  });
});
