import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 与 next-intl 文档一致：避免漏匹配导致根路径未带上 locale 而 404
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
