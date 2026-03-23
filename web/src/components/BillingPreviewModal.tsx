"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

export function BillingPreviewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("UserMenu");
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-preview-title"
    >
      <div
        className="flex min-h-full flex-col items-center justify-center bg-black/40 p-4 py-10"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl border border-[var(--outline-variant)]/20 bg-[var(--surface)] p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="billing-preview-title"
            className="font-headline text-lg font-semibold text-[var(--on-surface)]"
          >
            {t("billingTitle")}
          </h2>
          <p className="mt-3 font-medium text-[var(--on-surface)]">
            {locale === "zh" ? t("billingPriceZh") : t("billingPriceEn")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--on-surface-variant)]">
            {locale === "zh" ? t("billingDescZh") : t("billingDescEn")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-full bg-[var(--primary)] py-2.5 text-sm font-medium text-[var(--on-primary)] transition hover:opacity-95"
          >
            {t("billingClose")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
