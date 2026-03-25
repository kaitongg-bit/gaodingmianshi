import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./src/i18n/routing";
import { getSupabaseAnonKey, getSupabaseUrl } from "./src/lib/supabase/env";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  /** 排除 auth/callback：OAuth/重置密码回调由独立 Route Handler 换票并 Set-Cookie，不经 next-intl 改写 */
  matcher: ["/((?!api|_next|_vercel|auth/callback|.*\\..*).*)"],
};
