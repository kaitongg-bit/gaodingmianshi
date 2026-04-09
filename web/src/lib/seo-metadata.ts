import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "./site-url";

function pathForLocale(locale: string, pathAfterLocale: string): string {
  return pathAfterLocale ? `/${locale}/${pathAfterLocale}` : `/${locale}`;
}

/** hreflang：各语言绝对 URL + x-default（默认 en） */
export function localeHrefLang(pathAfterLocale: string): Record<string, string> {
  const base = getSiteUrl();
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = `${base}${pathForLocale(loc, pathAfterLocale)}`;
  }
  languages["x-default"] = `${base}${pathForLocale(routing.defaultLocale, pathAfterLocale)}`;
  return languages;
}

/** 公开营销页的 metadata 模板（canonical、多语言、OG、Twitter） */
export function publicPageMetadata(input: {
  locale: string;
  pathAfterLocale: string;
  title: string;
  description: string;
}): Metadata {
  const base = getSiteUrl();
  const path = pathForLocale(input.locale, input.pathAfterLocale);
  const url = `${base}${path}`;
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: path,
      languages: localeHrefLang(input.pathAfterLocale),
    },
    openGraph: {
      type: "website",
      url,
      title: input.title,
      description: input.description,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}
