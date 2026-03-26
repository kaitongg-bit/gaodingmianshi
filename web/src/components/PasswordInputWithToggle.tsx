"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { MaterialIcon } from "@/components/MaterialIcon";

type Props = {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  className?: string;
};

export function PasswordInputWithToggle({
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  className = "",
}: Props) {
  const t = useTranslations("Auth");
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative mt-2 ${className}`.trim()}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-0 bg-[var(--surface-container-lowest)] py-3 pl-4 pr-12 text-sm text-[var(--on-surface)] shadow-inner outline-none ring-1 ring-transparent transition focus:ring-[var(--primary)]"
      />
      <button
        type="button"
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]"
      >
        <MaterialIcon name={visible ? "visibility_off" : "visibility"} className="!text-xl" />
      </button>
    </div>
  );
}
