"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * 邮件确认/魔法链接若把用户带回站点根或带 locale 的首页（带 ?code= 或 #access_token=），
 * 避免停在营销页再点一次：换票或落 session 后直接进入产品。
 * 密码重置（type=recovery）则进更新密码页。
 */
export function PostEmailAuthHandoff() {
  const locale = useLocale();
  const router = useRouter();
  const doneRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || doneRef.current) return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (code && !url.pathname.includes("/auth/callback")) {
      doneRef.current = true;
      const next = `/${locale}/projects`;
      window.location.replace(
        `${url.origin}/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`,
      );
      return;
    }

    const rawHash = window.location.hash?.replace(/^#/, "") ?? "";
    if (!rawHash.includes("access_token=")) return;

    const hashParams = new URLSearchParams(rawHash);
    const type = hashParams.get("type");

    const supabase = createSupabaseBrowserClient();

    const stripHash = () => {
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    };

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      stripHash();
      if (type === "recovery") {
        router.replace("/auth/update-password");
        return;
      }
      router.replace("/projects");
    };

    let attempts = 0;
    const bumpSession = () => {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          finish();
          return;
        }
        if (attempts < 8) {
          attempts += 1;
          window.setTimeout(bumpSession, 120);
        }
      });
    };

    bumpSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        finish();
      }
    });

    return () => subscription.unsubscribe();
  }, [locale, router]);

  return null;
}
