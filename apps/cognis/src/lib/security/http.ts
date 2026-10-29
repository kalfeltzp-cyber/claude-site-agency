import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "./errors";
import { rateLimit, RATE_LIMITS } from "./rate-limit";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** Rejeita requisições mutáveis de outra origem (defesa contra CSRF além do SameSite=Lax). */
export function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // clientes não-navegador; cookies SameSite ainda protegem
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError(403, "bad_origin", "Origem inválida.");
  }
  if (!host || originHost !== host) throw new AppError(403, "bad_origin", "Origem não permitida.");
}

export function enforceRateLimit(req: Request, group: keyof typeof RATE_LIMITS, extraKey = "") {
  const { limit, windowMs } = RATE_LIMITS[group];
  const r = rateLimit(`${group}:${clientIp(req)}:${extraKey}`, limit, windowMs);
  if (!r.ok) {
    const err = new AppError(429, "rate_limited", "Muitas requisições. Aguarde alguns instantes e tente novamente.");
    (err as AppError & { retryAfter?: number }).retryAfter = r.retryAfterSeconds;
    throw err;
  }
}

const MAX_BODY_BYTES = 64 * 1024;

export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) throw new AppError(413, "too_large", "Corpo da requisição muito grande.");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new AppError(413, "too_large", "Corpo da requisição muito grande.");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new AppError(400, "invalid_json", "JSON inválido.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`).join("; ");
    throw new AppError(422, "validation_error", `Dados inválidos — ${msg}`);
  }
  return parsed.data;
}

/** Envolve um handler de rota com tratamento uniforme e seguro de erros. */
export function handler<C>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {};
    const retry = (err as AppError & { retryAfter?: number }).retryAfter;
    if (retry) headers["Retry-After"] = String(retry);
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status, headers });
  }
  console.error("[api] erro inesperado:", err);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Erro interno. Tente novamente em instantes." } },
    { status: 500 },
  );
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}
