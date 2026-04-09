import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/*/workspace",
          "/*/prep",
          "/*/projects",
          "/*/settings",
          "/*/question-bank",
          "/*/app",
          "/*/auth/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
