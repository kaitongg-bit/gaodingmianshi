import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DraftNav } from "@/components/DraftNav";
import { Link } from "@/i18n/navigation";
import { brandName } from "@/lib/brand";
import { routing } from "@/i18n/routing";
import { publicPageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tNav = await getTranslations({
    locale: locale as (typeof routing.locales)[number],
    namespace: "UserMenu",
  });
  const tSeo = await getTranslations({
    locale: locale as (typeof routing.locales)[number],
    namespace: "Seo",
  });
  const title = `${tNav("privacyPolicy")} · ${brandName(locale)}`;
  return publicPageMetadata({
    locale,
    pathAfterLocale: "privacy",
    title,
    description: tSeo("privacyDescription"),
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("UserMenu");

  return (
    <>
      <DraftNav variant="marketing" />
      <main id="main" className="mx-auto max-w-lg px-4 pb-24 pt-24">
        <Link href="/" className="text-sm font-medium text-[var(--primary)] hover:underline">
          ← {t("privacyBackHome")}
        </Link>
        <h1 className="mt-4 font-headline text-2xl font-semibold text-[var(--on-surface)]">
          {t("privacyPolicy")}
        </h1>
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">{t("privacyPageUpdated")}</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--on-surface-variant)]">
          <p>{t("privacyPageP1")}</p>
          <p>{t("privacyPageP2")}</p>
          <p>{t("privacyPageP3")}</p>
          <p>{t("privacyPageP4")}</p>
          <p>{t("privacyPageP5")}</p>
          <p>{t("privacyPageP6")}</p>
        </div>
      </main>
    </>
  );
}
