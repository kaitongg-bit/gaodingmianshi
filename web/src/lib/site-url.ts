function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * 规范站点根 URL（无末尾 `/`）。生产务必配置 NEXT_PUBLIC_SITE_URL，便于 canonical / OG / sitemap。
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").split("/")[0] ?? vercel;
    return `https://${trimTrailingSlash(host)}`;
  }

  return "http://localhost:3000";
}
