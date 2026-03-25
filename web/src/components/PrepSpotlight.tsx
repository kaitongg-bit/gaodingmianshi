"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

type Rect = { top: number; left: number; right: number; bottom: number };

function measure(el: HTMLElement | null, pad: number): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - pad,
    left: r.left - pad,
    right: r.right + pad,
    bottom: r.bottom + pad,
  };
}

/**
 * 四块遮罩留出中间「洞」，洞内可点击下层按钮；气泡固定在视口内。
 */
export function PrepSpotlight({
  open,
  anchorRef,
  title,
  body,
  dismissLabel,
  onDismiss,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  title: string;
  body: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  const [hole, setHole] = useState<Rect | null>(null);

  const update = useCallback(() => {
    if (!open) {
      setHole(null);
      return;
    }
    setHole(measure(anchorRef.current, 10));
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setHole(null);
      return;
    }
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => update()) : null;
    if (anchorRef.current && ro) ro.observe(anchorRef.current);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, update, anchorRef]);

  useEffect(() => {
    if (!open) return;
    anchorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open || !hole) return null;

  const { top, left, right, bottom } = hole;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const estBubble = 176;
  const bubbleTop = bottom + 12 + estBubble > vh - 16 ? Math.max(16, top - estBubble - 8) : bottom + 12;

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-[110] bg-black/45"
        style={{ height: Math.max(0, top) }}
        onClick={onDismiss}
        aria-hidden
      />
      <div
        className="fixed left-0 z-[110] bg-black/45"
        style={{ top, width: Math.max(0, left), height: Math.max(0, bottom - top) }}
        onClick={onDismiss}
        aria-hidden
      />
      <div
        className="fixed z-[110] bg-black/45"
        style={{ top, left: right, right: 0, height: Math.max(0, bottom - top) }}
        onClick={onDismiss}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[110] bg-black/45"
        style={{ top: bottom }}
        onClick={onDismiss}
        aria-hidden
      />

      <div
        className="pointer-events-none fixed z-[112] rounded-xl ring-4 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]"
        style={{
          top,
          left,
          width: Math.max(0, right - left),
          height: Math.max(0, bottom - top),
        }}
        aria-hidden
      />

      <div
        className="fixed left-1/2 z-[115] w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[var(--outline-variant)]/20 bg-[var(--surface)] p-4 shadow-2xl"
        style={{ top: bubbleTop }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prep-spotlight-title"
      >
        <h2 id="prep-spotlight-title" className="font-headline text-base font-semibold text-[var(--on-surface)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--on-surface-variant)]">{body}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full rounded-xl bg-[var(--primary)] py-2.5 text-sm font-medium text-[var(--on-primary)] transition hover:opacity-95"
        >
          {dismissLabel}
        </button>
      </div>
    </>
  );
}
