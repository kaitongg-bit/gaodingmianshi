import { getTranslations } from "next-intl/server";
import { AuthGate } from "@/components/AuthGate";
import { DraftNav } from "@/components/DraftNav";
import { Link } from "@/i18n/navigation";

export default async function SupportPage() {
  const t = await getTranslations("UserMenu");

  return (
    <>
      <DraftNav variant="marketing" />
      <AuthGate>
        <main id="main" className="mx-auto max-w-lg px-4 pb-24 pt-24">
        <Link
          href="/projects"
          className="text-sm font-medium text-[var(--primary)] hover:underline"
        >
          ←
        </Link>
        <h1 className="mt-4 font-headline text-2xl font-semibold text-[var(--on-surface)]">
          {t("contactSupport")}
        </h1>
        <p className="mt-3 text-[var(--on-surface-variant)]">{t("supportBody")}</p>
        </main>
      </AuthGate>
    </>
  );
}
