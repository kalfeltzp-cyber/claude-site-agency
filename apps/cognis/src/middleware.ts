import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Renova a sessão do Supabase (quando configurado) a cada requisição.
 * A autorização real acontece no servidor (rotas e páginas), nunca aqui.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    await supabase.auth.getUser();
  } catch (err) {
    // Configuração inválida do Supabase não pode derrubar o site inteiro; /status mostra o problema.
    console.error("[middleware] falha ao renovar sessão:", (err as Error).message);
    return NextResponse.next({ request });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
