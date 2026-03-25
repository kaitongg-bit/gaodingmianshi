import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { brandName } from "@/lib/brand";
import { DraftNav } from "@/components/DraftNav";
import { LandingBottomCta } from "@/components/LandingBottomCta";
import { LandingHeroCtas } from "@/components/LandingHeroCtas";
import { LandingHeroMockup } from "@/components/LandingHeroMockup";
import { MaterialIcon } from "@/components/MaterialIcon";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Landing");
  const brand = brandName(locale);
  const year = new Date().getFullYear();

  return (
    <div className="min-h-full bg-[var(--background)]">
      <DraftNav variant="marketing" />
      <main id="main" className="pt-20">
        <section className="mx-auto grid max-w-screen-2xl gap-12 px-6 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] md:items-center md:gap-16 md:px-8 lg:py-24">
          <div className="space-y-6 md:space-y-8">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--on-surface-variant)]">
              {t("heroKicker")}
            </p>
            <h1 className="font-headline text-4xl font-medium leading-tight tracking-tight text-[var(--on-surface)] md:text-5xl lg:text-[3.5rem]">
              {t("heroTitle")}{" "}
              <em className="not-italic" style={{ fontFamily: "var(--font-serif)" }}>
                {t("heroTitleItalic")}
              </em>{" "}
              {t("heroTitleRest")}
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-[var(--on-surface-variant)] md:text-lg">
              {t("heroSub")}
            </p>
            <LandingHeroCtas />
            <p className="max-w-lg text-xs leading-relaxed text-[var(--on-surface-variant)]">
              {t("heroNote")}
            </p>
          </div>
          <LandingHeroMockup />
        </section>

        <section
          id="journey"
          className="border-t border-[var(--outline-variant)]/10 bg-[var(--surface-container-low)] py-20"
        >
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <h2 className="font-headline text-center text-3xl font-medium text-[var(--on-surface)] md:text-4xl">
              {t("journeyTitle")}
            </h2>
            <div className="mt-14 grid gap-10 md:grid-cols-3">
              {[
                { icon: "description", title: t("j1Title"), body: t("j1Body") },
                { icon: "analytics", title: t("j2Title"), body: t("j2Body") },
                { icon: "view_sidebar", title: t("j3Title"), body: t("j3Body") },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-[var(--surface)]/80 p-8 text-center shadow-[0_4px_24px_rgba(49,51,44,0.04)]"
                >
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-container-low)]">
                    <MaterialIcon name={item.icon} className="text-[var(--primary)]" />
                  </div>
                  <h3 className="font-headline text-lg font-semibold text-[var(--on-surface)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <div className="grid gap-4 md:grid-cols-2 md:grid-rows-2 lg:min-h-[420px]">
            <div className="rounded-2xl bg-[var(--surface-container-low)] p-8 md:row-span-2">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-headline text-2xl font-semibold text-[var(--on-surface)]">
                    {t("bento1")}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--surface-container-highest)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
                      {t("bento1Tag1")}
                    </span>
                    <span className="rounded-full bg-[var(--surface-container-highest)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
                      {t("bento1Tag2")}
                    </span>
                  </div>
                </div>
                <MaterialIcon name="tune" className="text-4xl text-[var(--outline-variant)]" />
              </div>
            </div>
            <div className="flex min-h-[160px] items-center justify-between rounded-2xl bg-[var(--primary)] p-8 text-[var(--on-primary)]">
              <h3 className="font-headline text-xl font-semibold">{t("bento2")}</h3>
              <MaterialIcon name="explore" className="text-4xl opacity-90" />
            </div>
            <div className="flex min-h-[160px] items-center justify-between rounded-2xl bg-[var(--primary-container)] p-8 text-[var(--on-primary-container)]">
              <h3 className="font-headline text-xl font-semibold">{t("bento3")}</h3>
              <MaterialIcon name="code" className="text-4xl opacity-80" />
            </div>
            <div className="rounded-2xl bg-[var(--surface-container)] p-8 md:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:row-span-2">
              <h3 className="font-headline text-2xl font-semibold text-[var(--on-surface)]">
                {t("bento4")}
              </h3>
              <p className="mt-4 rounded-xl bg-[var(--surface-container-lowest)] p-6 font-headline text-lg italic leading-relaxed text-[var(--on-surface-variant)]">
                {t("bentoQuote")}
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--outline-variant)]/10 bg-[var(--surface-container-low)] py-20 text-center">
          <h2 className="font-headline text-3xl font-medium text-[var(--on-surface)] md:text-4xl">
            {t("ctaBottomTitle")}{" "}
            <em className="not-italic text-[var(--primary)]" style={{ fontFamily: "var(--font-serif)" }}>
              {t("ctaBottomItalic")}
            </em>{" "}
            {t("ctaBottomTitleRest")}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-[var(--on-surface-variant)]">
            {t("ctaBottomSub")}
          </p>
          <LandingBottomCta />
          <p className="mt-4 text-xs italic text-[var(--on-surface-variant)]">{t("ctaBottomNote")}</p>
        </section>

        <footer className="border-t border-[var(--outline-variant)]/10 bg-[var(--surface)] py-14">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-4 md:px-8">
            <div>
              <div className="flex items-center gap-2.5">
                <Image
                  src="/logo-mark.png"
                  alt=""
                  width={32}
                  height={32}
                  className="shrink-0 rounded-md object-contain"
                />
                <p className="font-headline text-lg font-semibold text-[var(--on-surface)]">{brand}</p>
              </div>
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{t("footerTagline")}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                {t("footerProduct")}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--on-surface)]">
                <li>
                  <span className="hover:text-[var(--primary)]">{t("footerFeatures")}</span>
                </li>
                <li>
                  <span className="hover:text-[var(--primary)]">{t("footerPricing")}</span>
                </li>
                <li>
                  <span className="hover:text-[var(--primary)]">{t("footerCase")}</span>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                {t("footerCompany")}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--on-surface)]">
                <li>{t("footerAbout")}</li>
                <li>{t("footerPhilosophy")}</li>
                <li>{t("footerPrivacy")}</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                {t("footerConnect")}
              </p>
              <p className="mt-3 text-sm text-[var(--on-surface-variant)]">LinkedIn · X</p>
            </div>
          </div>
          <div className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-between gap-4 border-t border-[var(--outline-variant)]/10 px-4 pt-8 text-xs text-[var(--on-surface-variant)] md:px-8">
            <span>{t("footerCopy", { year })}</span>
            <span className="flex gap-4">
              <span>{t("footerTerms")}</span>
              <span>{t("footerCookies")}</span>
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
