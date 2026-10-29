import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";
import { supabaseServer } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Confirmação de e-mail do Supabase (token_hash ou code PKCE). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const done = new URL("/perfil", url.origin);
  const fail = new URL("/entrar?erro=confirmacao", url.origin);
  if (getConfig().authMode !== "supabase") return NextResponse.redirect(fail);
  const supabase = await supabaseServer();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return NextResponse.redirect(error ? fail : done);
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(error ? fail : done);
  }
  return NextResponse.redirect(fail);
}
