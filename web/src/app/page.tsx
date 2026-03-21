import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

/**
 * 根路径无 [locale] 段时，直接跳到默认语言（与 middleware 双保险）。
 */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
