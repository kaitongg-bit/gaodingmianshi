import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

/** 仅收录公开营销页；App / 登录相关路径由 robots.txt 限制 */
const PUBLIC_SEGMENTS = ["", "privacy", "support"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const seg of PUBLIC_SEGMENTS) {
      const path = seg ? `/${locale}/${seg}` : `/${locale}`;
      entries.push({
        url: `${base}${path}`,
        lastModified: new Date(),
        changeFrequency: seg === "" ? "weekly" : "monthly",
        priority: seg === "" ? 1 : 0.65,
      });
    }
  }

  return entries;
}
