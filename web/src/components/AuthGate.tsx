"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setOk(true);
        return;
      }
      router.replace("/auth/login", { locale });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setOk(true);
      } else {
        setOk(false);
        router.replace("/auth/login", { locale });
      }
    });

    return () => subscription.unsubscribe();
  }, [router, locale]);

  if (!ok) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-[var(--background)] text-sm text-[var(--on-surface-variant)]">
        …
      </div>
    );
  }

  return <>{children}</>;
}
