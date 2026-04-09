"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AcquisitionSurveyModal } from "@/components/AcquisitionSurveyModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type GateState = "pending" | "in" | "out";

/**
 * 等待 Supabase INITIAL_SESSION 再判定，避免 getSession 尚未就绪时误跳登录页。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const [gate, setGate] = useState<GateState>("pending");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "INITIAL_SESSION") {
        setGate(session ? "in" : "out");
        return;
      }
      if (event === "SIGNED_IN") {
        setGate("in");
        return;
      }
      if (event === "SIGNED_OUT") {
        setGate("out");
      }
    });

    const fallback = window.setTimeout(() => {
      if (cancelled) return;
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        setGate((g) => (g === "pending" ? (session ? "in" : "out") : g));
      });
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (gate !== "out") return;
    router.replace("/auth/login", { locale });
  }, [gate, router, locale]);

  if (gate !== "in") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-[var(--background)] text-sm text-[var(--on-surface-variant)]">
        …
      </div>
    );
  }

  return (
    <>
      {children}
      <AcquisitionSurveyModal />
    </>
  );
}
