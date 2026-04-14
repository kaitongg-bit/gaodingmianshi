"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { GoogleOAuthButton } from "@/components/GoogleOAuthButton";
import { PasswordInputWithToggle } from "@/components/PasswordInputWithToggle";
import { messageForOAuthCallbackReason } from "@/lib/auth-oauth-error";
import { clearStoredUser } from "@/lib/client-session";
import { reportAuthError } from "@/lib/client/report-auth-error";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const oauthReason =
    searchParams.get("error") === "auth" ? searchParams.get("reason") : null;
  const oauthErr = oauthReason ? messageForOAuthCallbackReason(oauthReason, t) : null;

  useEffect(() => {
    if (oauthReason) {
      reportAuthError({
        source: "oauth_callback",
        reason: oauthReason,
        message: "OAuth callback redirected with auth error",
      });
    }
  }, [oauthReason]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim() || !password) return;
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      const code = error.code ?? "";
      const msg = error.message.toLowerCase();
      reportAuthError({
        source: "login_password",
        reason: code || "sign_in_failed",
        message: error.message,
        emailHint: email.trim().toLowerCase(),
      });
      if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
        setErr(t("confirmEmail"));
        return;
      }
      setErr(error.message);
      return;
    }
    clearStoredUser();
    router.replace("/projects");
  }

  return (
    <div className="space-y-5">
      {err || oauthErr ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {err ?? oauthErr}
        </p>
      ) : null}
      <GoogleOAuthButton
        onError={(msg) => setErr(msg === "oauth_no_url" ? t("oauthFailedUnknown") : msg)}
      />
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--outline-variant)]/35" />
        <span className="text-xs text-[var(--on-surface-variant)]">{t("orContinueEmail")}</span>
        <div className="h-px flex-1 bg-[var(--outline-variant)]/35" />
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
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
          className="mt-2 w-full rounded-xl border-0 bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-[var(--on-surface)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--primary)]"
        />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium uppercase tracking-widest text-[var(--on-surface-variant)]">
            {t("password")}
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-xs font-medium text-[var(--primary)] underline-offset-4 hover:underline"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        <PasswordInputWithToggle
          value={password}
          onChange={setPassword}
          required
          minLength={6}
          autoComplete="current-password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[var(--primary)] py-3.5 text-sm font-medium text-[var(--on-primary)] shadow-[var(--shadow-ambient)] transition hover:opacity-95 disabled:opacity-50"
      >
        {loading ? "…" : t("submitLogin")}
      </button>
      <p className="text-center text-sm text-[var(--on-surface-variant)]">
        {t("noAccount")}{" "}
        <Link href="/auth/register" className="font-medium text-[var(--primary)] underline-offset-4 hover:underline">
          {t("submitRegister")}
        </Link>
      </p>
      </form>
    </div>
  );
}
