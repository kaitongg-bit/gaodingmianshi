import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { classifyExchangeError } from "@/lib/auth-oauth-error";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

function loginLocaleFromNext(next: string): string {
  const m = next.match(/^\/(en|zh)(\/|$)/);
  return m?.[1] ?? "en";
}

/**
 * OAuth / magic-link / recovery：Supabase 重定向到此 URL 并带上 ?code=
 * 需在 Supabase → Authentication → URL configuration 的 Redirect URLs 中加入：
 *   https://<你的域名>/auth/callback
 *   http://localhost:3000/auth/callback
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next");
  const next = nextRaw?.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/en/projects";
  const locale = loginLocaleFromNext(next);

  const loginUrl = (reason: string) =>
    new URL(`/${locale}/auth/login?error=auth&reason=${encodeURIComponent(reason)}`, url.origin);

  if (!code) {
    return NextResponse.redirect(loginUrl("missing_code"));
  }

  const redirectResponse = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          redirectResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const reason = classifyExchangeError(error.message);
    return NextResponse.redirect(loginUrl(reason));
  }

  return redirectResponse;
}
