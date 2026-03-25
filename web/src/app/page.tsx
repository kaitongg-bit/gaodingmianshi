import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

/**
 * 根路径无 [locale] 段：尊重 next-intl 写入的 NEXT_LOCALE（与语言切换一致），否则用默认语言。
 */
export default async function RootPage() {
  const jar = await cookies();
  const fromCookie = jar.get("NEXT_LOCALE")?.value;
  const locale =
    fromCookie && (routing.locales as readonly string[]).includes(fromCookie)
      ? fromCookie
      : routing.defaultLocale;
  redirect(`/${locale}`);
}
