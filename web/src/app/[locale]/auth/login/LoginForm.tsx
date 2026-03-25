"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { clearStoredUser } from "@/lib/client-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      {err ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{err}</p>
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
          className="mt-2 w-full rounded-xl border-0 bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-[var(--on-surface)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--primary)]"
        />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-widest text-[var(--on-surface-variant)]">
          {t("password")}
        </label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-xl border-0 bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-[var(--on-surface)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--primary)]"
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
  );
}
