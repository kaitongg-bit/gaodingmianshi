import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Inter, Newsreader } from "next/font/google";
import "../globals.css";
import { routing } from "@/i18n/routing";
import { PageTransitionShell } from "@/components/PageTransitionShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as (typeof routing.locales)[number],
    namespace: "LocaleLayout",
  });
  return {
    title: t("title"),
    description: t("description"),
    icons: {
      icon: [{ url: "/logo-mark.png", type: "image/png" }],
      apple: [{ url: "/logo-mark.png", type: "image/png" }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  /** 与 URL 段一致；避免页面独立渲染时未命中 setRequestLocale 而误载 defaultLocale 文案 */
  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${newsreader.variable} h-full min-h-dvh`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
      </head>
      <body className="flex min-h-dvh flex-col overflow-x-hidden antialiased selection:bg-[var(--primary-container)] selection:text-[var(--on-primary-container)]">
        <NextIntlClientProvider messages={messages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-2 focus:rounded-lg focus:bg-[var(--primary)] focus:px-3 focus:py-2 focus:text-[var(--on-primary)]"
          >
            {locale === "zh" ? "跳到正文" : "Skip to content"}
          </a>
          <PageTransitionShell>{children}</PageTransitionShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
