"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LandingBottomCta() {
  const t = useTranslations("Landing");
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (hasSession === null) {
    return (
      <div
        className="mx-auto mt-8 h-14 w-56 max-w-full animate-pulse rounded-full bg-[var(--surface-container-high)]"
        aria-hidden
      />
    );
  }

  const href = hasSession ? "/projects" : "/auth/register";
  const label = hasSession ? t("ctaLoggedInProjects") : t("ctaBottomButton");

  return (
    <Link
      href={href}
      className="mt-8 inline-flex rounded-full bg-[var(--primary)] px-10 py-4 text-base font-medium text-[var(--on-primary)] shadow-[var(--shadow-ambient)] hover:opacity-95"
    >
      {label}
    </Link>
  );
}
