import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  /** 英文默认；中文品牌名「稿定面试」在文案中体现 */
  locales: ["en", "zh"],
  defaultLocale: "en",
  localePrefix: "always",
});
