import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DraftNav } from "@/components/DraftNav";
import { brandName } from "@/lib/brand";
import { routing } from "@/i18n/routing";
import { publicPageMetadata } from "@/lib/seo-metadata";
import { SupportForm } from "./SupportForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tS = await getTranslations({
    locale: locale as (typeof routing.locales)[number],
    namespace: "Support",
  });
  const tSeo = await getTranslations({
    locale: locale as (typeof routing.locales)[number],
    namespace: "Seo",
  });
  const title = `${tS("title")} · ${brandName(locale)}`;
  return publicPageMetadata({
    locale,
    pathAfterLocale: "support",
    title,
    description: tSeo("supportDescription"),
  });
}

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <DraftNav variant="marketing" />
      <main id="main" className="mx-auto max-w-lg px-4 pb-24 pt-24">
        <SupportForm />
      </main>
    </>
  );
}
