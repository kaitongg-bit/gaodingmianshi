"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SupportForm() {
  const t = useTranslations("Support");
  const [category, setCategory] = useState<"feedback" | "bug">("feedback");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setSessionReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, body: text }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) {
        setErr(j.error ?? "error");
        return;
      }
      setDone(true);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/" className="text-sm font-medium text-[var(--primary)] hover:underline">
        ← {t("backHome")}
      </Link>
      <h1 className="mt-4 font-headline text-2xl font-semibold text-[var(--on-surface)]">
        {t("title")}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--on-surface-variant)]">
        {hasSession ? t("intro") : t("introGuest")}
      </p>

      {!sessionReady ? (
        <p className="mt-8 text-sm text-[var(--on-surface-variant)]">…</p>
      ) : !hasSession ? (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/auth/login"
            className="inline-flex justify-center rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-medium text-[var(--on-primary)] hover:opacity-95"
          >
            {t("loginCta")}
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex justify-center text-sm font-medium text-[var(--primary)] underline-offset-4 hover:underline"
          >
            {t("registerCta")}
          </Link>
        </div>
      ) : (
        <>
          {done ? (
            <p className="mt-6 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/5 px-4 py-3 text-sm text-[var(--on-surface)]">
              {t("thanks")}
            </p>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("categoryLabel")}
              </legend>
              <div className="flex flex-wrap gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--on-surface)]">
                  <input
                    type="radio"
                    name="cat"
                    checked={category === "feedback"}
                    onChange={() => setCategory("feedback")}
                    className="accent-[var(--primary)]"
                  />
                  {t("categoryFeedback")}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--on-surface)]">
                  <input
                    type="radio"
                    name="cat"
                    checked={category === "bug"}
                    onChange={() => setCategory("bug")}
                    className="accent-[var(--primary)]"
                  />
                  {t("categoryBug")}
                </label>
              </div>
            </fieldset>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {t("messageLabel")}
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                required
                className="mt-2 w-full resize-y rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm leading-relaxed text-[var(--on-surface)] outline-none focus:ring-1 focus:ring-[var(--primary)]/25"
                placeholder={t("messagePlaceholder")}
                disabled={busy}
              />
            </label>

            {err ? (
              <p className="text-sm text-[var(--error)]">
                {err === "unauthorized"
                  ? t("errors.unauthorized")
                  : err === "empty_body"
                    ? t("errors.empty_body")
                    : err === "body_too_long"
                      ? t("errors.body_too_long")
                      : err === "invalid_category"
                        ? t("errors.invalid_category")
                        : err === "invalid_json"
                          ? t("errors.invalid_json")
                          : t("errors.generic")}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-medium text-[var(--on-primary)] transition hover:opacity-95 disabled:opacity-40"
            >
              {busy ? t("submitting") : t("submit")}
            </button>
          </form>
        </>
      )}
    </>
  );
}
