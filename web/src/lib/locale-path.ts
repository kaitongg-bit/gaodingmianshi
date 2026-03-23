/**
 * 保证传给 next-intl `router.replace(path, { locale })` 的 path 不再包含语言前缀，
 * 否则在部分环境下会拼成 `/zh/zh` 这类重复前缀。
 */
export function pathnameWithoutLocalePrefix(
  pathname: string | null | undefined,
  locales: readonly string[],
): string {
  if (!pathname) return "/";
  let p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  for (const loc of locales) {
    const prefix = `/${loc}`;
    if (p === prefix) return "/";
    if (p.startsWith(`${prefix}/`)) {
      return p.slice(prefix.length) || "/";
    }
  }
  return p;
}
