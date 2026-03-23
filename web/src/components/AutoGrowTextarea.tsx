"use client";

import { forwardRef, useLayoutEffect, useRef } from "react";
import type { MutableRefObject, Ref, TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  /**
   * 超过后开始内部滚动，单位 px。
   * 不传则由高度随内容无限增高，滚动交给外层容器。
   */
  maxHeightPx?: number;
};

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (ref == null) continue;
      if (typeof ref === "function") ref(value);
      else (ref as MutableRefObject<T | null>).current = value;
    }
  };
}

/**
 * 从约一行高度起随内容增高，避免大段空白占位；默认不封顶，避免嵌套滚轮。
 */
export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoGrowTextarea(
  { value, maxHeightPx, className = "", onChange, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const setRef = mergeRefs(innerRef, forwardedRef);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const h = el.scrollHeight;
    if (maxHeightPx != null) {
      const capped = Math.min(h, maxHeightPx);
      el.style.height = `${capped}px`;
      el.style.overflowY = h > maxHeightPx ? "auto" : "hidden";
    } else {
      el.style.height = `${h}px`;
      el.style.overflowY = "hidden";
    }
  }, [value, maxHeightPx]);

  return (
    <textarea
      ref={setRef}
      rows={1}
      value={value}
      onChange={onChange}
      className={className}
      {...rest}
    />
  );
});
