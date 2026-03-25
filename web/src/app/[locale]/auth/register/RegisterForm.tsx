"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { clearStoredUser } from "@/lib/client-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (!email.trim() || !password) return;
    if (password.length < 6) {
      setErr(t("passwordTooShort"));
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const trimmed = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        data: {
          display_name: name.trim() || undefined,
        },
      },
    });
    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    clearStoredUser();

    if (data.session) {
      setLoading(false);
      router.replace("/projects");
      return;
    }

    // 关闭「邮箱确认」后，部分情况下 signUp 仍可能不返回 session；立刻用同一密码登录一次
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setLoading(false);

    if (signInData.session) {
      router.replace("/projects");
      return;
    }

    if (signInError) {
      const code = signInError.code ?? "";
      const msg = signInError.message.toLowerCase();
      if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
        setInfo(t("confirmEmail"));
        return;
      }
      if (
        code === "invalid_credentials" ||
        msg.includes("invalid login credentials") ||
        msg.includes("invalid_credentials")
      ) {
        setInfo(t("registerNoSessionHint"));
        return;
      }
      setErr(signInError.message);
      return;
    }

    // 无 error 也无 session：少见；若已关邮箱确认，不宜再提示「去邮箱验证」
    setInfo(t("registerNoSessionHint"));
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      {err ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{err}</p>
      ) : null}
      {info ? (
        <p className="rounded-lg bg-[var(--primary-container)]/40 px-3 py-2 text-sm text-[var(--on-surface)]">
          {info}
        </p>
      ) : null}
      <div>
        <label className="text-xs font-medium uppercase tracking-widest text-[var(--on-surface-variant)]">
          {t("name")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-xl border-0 bg-[var(--surface-container-lowest)] px-4 py-3 text-sm text-[var(--on-surface)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--primary)]"
        />
      </div>
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
          autoComplete="new-password"
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
        {loading ? "…" : t("submitRegister")}
      </button>
      <p className="text-center text-sm text-[var(--on-surface-variant)]">
        {t("hasAccount")}{" "}
        <Link href="/auth/login" className="font-medium text-[var(--primary)] underline-offset-4 hover:underline">
          {t("submitLogin")}
        </Link>
      </p>
    </form>
  );
}
