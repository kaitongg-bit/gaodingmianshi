"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) {
      setErr(t("passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setErr(t("passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (error) {
        setErr(error.message);
        return;
      }
      router.replace("/projects");
    } catch {
      setLoading(false);
      setErr(t("genericError"));
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      {err ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{err}</p>
      ) : null}
      <div>
        <label className="text-xs font-medium uppercase tracking-widest text-[var(--on-surface-variant)]">
          {t("newPassword")}
        </label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-xl border-0 bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-[var(--on-surface)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--primary)]"
        />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-widest text-[var(--on-surface-variant)]">
          {t("confirmPassword")}
        </label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-2 w-full rounded-xl border-0 bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-[var(--on-surface)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--primary)]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[var(--primary)] py-3.5 text-sm font-medium text-[var(--on-primary)] shadow-[var(--shadow-ambient)] transition hover:opacity-95 disabled:opacity-50"
      >
        {loading ? "…" : t("saveNewPassword")}
      </button>
    </form>
  );
}
