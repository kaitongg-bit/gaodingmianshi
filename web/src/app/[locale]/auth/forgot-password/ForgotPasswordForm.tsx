"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { reportAuthError } from "@/lib/client/report-auth-error";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const next = `/${locale}/auth/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      });
      setLoading(false);
      if (error) {
        reportAuthError({
          source: "forgot_password",
          reason: error.code ?? "reset_password_failed",
          message: error.message,
          emailHint: trimmed.toLowerCase(),
        });
        setErr(error.message);
        return;
      }
      setSent(true);
    } catch (e) {
      setLoading(false);
      reportAuthError({
        source: "forgot_password",
        reason: "network",
        message: e instanceof Error ? e.message : "network_error",
        emailHint: trimmed.toLowerCase(),
      });
      setErr(t("genericError"));
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      {err ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{err}</p>
      ) : null}
      {sent ? (
        <p className="rounded-lg bg-[var(--primary-container)]/40 px-3 py-2 text-sm text-[var(--on-surface)]">
          {t("resetEmailSent")}
        </p>
      ) : null}
      <div>
        <label className="text-xs font-medium uppercase tracking-widest text-[var(--on-surface-variant)]">
          {t("email")}
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={sent}
          className="mt-2 w-full rounded-xl border-0 bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-[var(--on-surface)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--primary)] disabled:opacity-60"
        />
      </div>
      <button
        type="submit"
        disabled={loading || sent}
        className="w-full rounded-xl bg-[var(--primary)] py-3.5 text-sm font-medium text-[var(--on-primary)] shadow-[var(--shadow-ambient)] transition hover:opacity-95 disabled:opacity-50"
      >
        {loading ? "…" : t("sendResetLink")}
      </button>
      <p className="text-center text-sm text-[var(--on-surface-variant)]">
        <Link href="/auth/login" className="font-medium text-[var(--primary)] underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}
