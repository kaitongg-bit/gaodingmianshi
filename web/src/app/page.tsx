import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

/**
 * 根路径无 [locale] 段：尊重 next-intl 写入的 NEXT_LOCALE（与语言切换一致），否则用默认语言。
 * 保留查询串（如邮件回调 ?code=），避免换票参数在跳转到 /{locale} 时丢失。
 */
export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  const fromCookie = jar.get("NEXT_LOCALE")?.value;
  const locale =
    fromCookie && (routing.locales as readonly string[]).includes(fromCookie)
      ? fromCookie
      : routing.defaultLocale;

  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const q = qs.toString();

  redirect(`/${locale}${q ? `?${q}` : ""}`);
}
