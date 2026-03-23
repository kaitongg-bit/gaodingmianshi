"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { pathnameWithoutLocalePrefix } from "@/lib/locale-path";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = pathnameWithoutLocalePrefix(usePathname(), routing.locales);
  const router = useRouter();
  const nextLocale = locale === "en" ? "zh" : "en";
  const label = nextLocale === "zh" ? "中文" : "EN";

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)]"
    >
      {label}
    </button>
  );
}
