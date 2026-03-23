/** 路由段加载时占位，避免纯白屏；与正文背景色一致 */
export default function LocaleSegmentLoading() {
  return (
    <div
      className="min-h-[50vh] bg-[var(--background)]"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="mx-auto max-w-3xl px-4 pt-24">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface-container-high)]/80" />
        <div className="mt-6 h-4 w-full max-w-xl animate-pulse rounded bg-[var(--surface-container)]/90" />
        <div className="mt-3 h-4 w-full max-w-lg animate-pulse rounded bg-[var(--surface-container)]/70" />
      </div>
    </div>
  );
}
