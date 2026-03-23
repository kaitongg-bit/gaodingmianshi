import type { ReactNode } from "react";

/** 三栏工作区占满视口高度，滚动只发生在各栏内部，避免整页被右侧长列表撑出空白滚动条。 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
}
