"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  ACQUISITION_SURVEY_BONUS_CREDITS,
  ACQUISITION_SURVEY_CHANNELS,
  type AcquisitionSurveyChannel,
} from "@/lib/acquisition-survey-bonus";
import { trackEvent } from "@/lib/analytics";

const SNOOZE_KEY = "acquisition_survey_snooze";

function clearSurveySnooze() {
  try {
    sessionStorage.removeItem(SNOOZE_KEY);
  } catch {
    /* ignore */
  }
}

function dispatchMeRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("draftready:me-refresh"));
}

export function AcquisitionSurveyModal() {
  const t = useTranslations("AcquisitionSurvey");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<AcquisitionSurveyChannel | null>(null);
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const snooze = useCallback(() => {
    try {
      sessionStorage.setItem(SNOOZE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  const applyCompleted = useCallback(() => {
    clearSurveySnooze();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    void (async () => {
      const r = await fetch("/api/me/acquisition-survey", { cache: "no-store" });
      if (cancelled || !r.ok) return;
      const j = (await r.json()) as { completed?: boolean };

      if (j.completed) {
        applyCompleted();
        return;
      }

      try {
        if (sessionStorage.getItem(SNOOZE_KEY) === "1") return;
      } catch {
        /* ignore */
      }

      if (cancelled) return;
      setOpen(true);
      trackEvent("acquisition_survey_view");
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, applyCompleted]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") snooze();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, snooze]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function onSubmit() {
    setError(null);
    if (!channel) {
      setError(t("errorPickChannel"));
      return;
    }
    if (channel === "other") {
      const o = otherText.trim();
      if (!o.length) {
        setError(t("errorOtherRequired"));
        return;
      }
      if (o.length > 500) {
        setError(t("errorGeneric"));
        return;
      }
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/me/acquisition-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          otherDetail: channel === "other" ? otherText.trim() : "",
        }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        creditsBalance?: number;
        error?: string;
      };

      if (r.ok && j.ok) {
        trackEvent("acquisition_survey_submit", { channel });
        clearSurveySnooze();
        dispatchMeRefresh();
        setOpen(false);
        return;
      }

      if (r.status === 409) {
        clearSurveySnooze();
        dispatchMeRefresh();
        setOpen(false);
        return;
      }

      trackEvent("acquisition_survey_fail", {
        code: j.error ?? String(r.status),
      });
      setError(r.status === 0 ? t("errorNetwork") : t("errorGeneric"));
    } catch {
      trackEvent("acquisition_survey_fail", { code: "network" });
      setError(t("errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[190] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acquisition-survey-title"
    >
      <div
        className="flex min-h-full flex-col items-center justify-center bg-black/45 p-4 py-10"
        onClick={snooze}
      >
        <div
          className="w-full max-w-md rounded-2xl border border-[var(--outline-variant)]/20 bg-[var(--surface)] p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="acquisition-survey-title"
            className="font-headline text-lg font-semibold text-[var(--on-surface)]"
          >
            {t("title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--primary)]">
            {t("bonusHint", { n: ACQUISITION_SURVEY_BONUS_CREDITS })}
          </p>

          <div className="mt-5 flex flex-col gap-2">
            {ACQUISITION_SURVEY_CHANNELS.map((ch) => (
              <label
                key={ch}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                  channel === ch
                    ? "border-[var(--primary)]/50 bg-[var(--primary)]/8"
                    : "border-[var(--outline-variant)]/25 hover:border-[var(--outline-variant)]/45"
                }`}
              >
                <input
                  type="radio"
                  name="acquisition-channel"
                  className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                  checked={channel === ch}
                  onChange={() => {
                    setChannel(ch);
                    setError(null);
                  }}
                />
                <span className="text-[var(--on-surface)]">{t(`channel_${ch}`)}</span>
              </label>
            ))}
          </div>

          {channel === "other" ? (
            <textarea
              value={otherText}
              onChange={(e) => {
                setOtherText(e.target.value);
                setError(null);
              }}
              rows={3}
              maxLength={500}
              placeholder={t("otherPlaceholder")}
              className="mt-3 w-full resize-none rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm leading-relaxed text-[var(--on-surface)] outline-none focus:ring-1 focus:ring-[var(--primary)]/25"
            />
          ) : null}

          {error ? (
            <p className="mt-3 text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
            <button
              type="button"
              disabled={submitting || !channel}
              onClick={() => void onSubmit()}
              className="w-full rounded-full bg-[var(--primary)] py-2.5 text-sm font-medium text-[var(--on-primary)] transition hover:opacity-95 disabled:opacity-40 sm:w-auto sm:min-w-[7.5rem]"
            >
              {submitting ? t("submitting") : t("submit")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={snooze}
              className="w-full rounded-full border border-[var(--outline-variant)]/35 py-2.5 text-sm font-medium text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] disabled:opacity-40 sm:w-auto sm:min-w-[7.5rem]"
            >
              {t("later")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
