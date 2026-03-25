import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DraftNav } from "@/components/DraftNav";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export default async function UpdatePasswordPage({
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
          href="/auth/login"
          className="mb-8 text-sm text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
        >
          ← {t("backToLogin")}
        </Link>
        <h1 className="font-headline text-4xl font-medium text-[var(--on-surface)]">{t("updatePasswordTitle")}</h1>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{t("updatePasswordSub")}</p>
        <div className="mt-10 rounded-2xl bg-[var(--surface-container-low)]/60 p-8 shadow-[0_10px_40px_rgba(49,51,44,0.06)]">
          <UpdatePasswordForm />
        </div>
      </main>
    </div>
  );
}
