import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DraftNav } from "@/components/DraftNav";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <div className="min-h-full bg-[var(--background)]">
      <DraftNav variant="marketing" />
      <main id="main" className="mx-auto flex max-w-md flex-col px-4 pb-24 pt-28">
        <Link
          href="/"
          className="mb-8 text-sm text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
        >
          ← Home
        </Link>
        <h1 className="font-headline text-4xl font-medium text-[var(--on-surface)]">{t("registerTitle")}</h1>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{t("registerSub")}</p>
        <div className="mt-10 rounded-2xl bg-[var(--surface-container-low)]/60 p-8 shadow-[0_10px_40px_rgba(49,51,44,0.06)]">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-[var(--surface-container-high)]/30" />}>
            <RegisterForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs italic text-[var(--on-surface-variant)]">{t("complianceNote")}</p>
      </main>
    </div>
  );
}
