"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MaterialIcon } from "@/components/MaterialIcon";

export function LandingHeroCtas() {
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
      <div className="mt-8 flex min-h-[48px] flex-wrap gap-3" aria-hidden>
        <div className="h-12 w-40 animate-pulse rounded-full bg-[var(--surface-container-high)]" />
        <div className="h-12 w-36 animate-pulse rounded-full bg-[var(--surface-container-high)]" />
      </div>
    );
  }

  if (hasSession) {
    return (
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--on-primary)] shadow-[var(--shadow-ambient)] transition hover:opacity-95"
        >
          {t("ctaLoggedInProjects")}
          <MaterialIcon name="arrow_forward" className="!text-lg text-[var(--on-primary)]" />
        </Link>
        <Link
          href="/prep"
          className="inline-flex items-center rounded-full border border-[var(--outline-variant)]/40 bg-[var(--surface-container-lowest)] px-6 py-3 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
        >
          {t("ctaLoggedInPrep")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href="/auth/register"
        className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--on-primary)] shadow-[var(--shadow-ambient)] transition hover:opacity-95"
      >
        {t("ctaPrimary")}
        <MaterialIcon name="arrow_forward" className="!text-lg text-[var(--on-primary)]" />
      </Link>
      <a
        href="#journey"
        className="inline-flex items-center rounded-full border border-[var(--outline-variant)]/40 bg-[var(--surface-container-lowest)] px-6 py-3 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
      >
        {t("ctaSecondary")}
      </a>
    </div>
  );
}
