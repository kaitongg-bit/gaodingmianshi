import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Root passthrough; `<html>` lives in `[locale]/layout.tsx` (next-intl 推荐结构). */
export default function RootLayout({ children }: Props) {
  return children;
}
