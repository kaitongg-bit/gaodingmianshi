import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/SiteHeader";

export default async function LandingPage() {
  const t = await getTranslations("Landing");

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader variant="marketing" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-16">
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            InterviewScript / 稿定面试
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-[var(--text)]">
            {t("heroTitle")}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/app"
              className="rounded-[var(--radius-sm)] bg-[var(--text)] px-4 py-2 text-sm text-[var(--surface)] hover:opacity-90"
            >
              {t("ctaDemo")}
            </Link>
            <Link
              href="/app"
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-muted)]"
            >
              {t("ctaApp")}
            </Link>
          </div>
        </section>

        <section className="surface-card grid gap-4 p-5">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            {t("pricingTitle")}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">{t("pricingBody")}</p>
          <button
            type="button"
            className="w-fit rounded-[var(--radius-sm)] bg-[var(--accent-muted)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]"
          >
            {t("ctaMember")}
          </button>
        </section>

        <section className="surface-card grid gap-4 p-5">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            {t("shareTitle")}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">{t("shareBody")}</p>
          <button
            type="button"
            className="w-fit rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)]"
          >
            {t("shareTitle")}
          </button>
        </section>

        <footer className="flex gap-4 border-t border-[var(--border)] pt-8 text-xs text-[var(--text-muted)]">
          <span>{t("footerPrivacy")}</span>
          <span>{t("footerTerms")}</span>
        </footer>
      </main>
    </div>
  );
}
