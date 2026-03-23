"use client";

import { usePathname } from "@/i18n/navigation";

/**
 * 路由切换时用轻量淡入+位移，减轻白屏感（与 prefers-reduced-motion 兼容）。
 */
export function PageTransitionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-transition-enter flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
