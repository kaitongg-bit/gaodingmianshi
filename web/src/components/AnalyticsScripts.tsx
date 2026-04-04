"use client";

import Script from "next/script";

/** 默认使用稿定面试 Clarity 项目；可用 NEXT_PUBLIC_CLARITY_PROJECT_ID 覆盖；设为空字符串可关闭 */
const envClarity = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
const CLARITY_ID =
  (envClarity !== undefined ? envClarity.trim() : "w67f77050w") || null;

/**
 * Microsoft Clarity（afterInteractive）。显式 `NEXT_PUBLIC_CLARITY_PROJECT_ID=` 时不加载。
 */
export function AnalyticsScripts() {
  if (!CLARITY_ID) return null;

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(CLARITY_ID)});
      `.trim()}
    </Script>
  );
}
