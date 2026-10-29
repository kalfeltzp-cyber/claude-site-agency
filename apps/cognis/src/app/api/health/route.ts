import { db } from "@/lib/db/pool";
import { json } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.query("select 1");
    return json({ ok: true, database: "up" });
  } catch {
    return json({ ok: false, database: "down" }, { status: 503 });
  }
}
