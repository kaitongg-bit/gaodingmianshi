"use client";

import { useLayoutEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  /**
   * 超过后开始内部滚动，单位 px。
   * 不传则由高度随内容无限增高，滚动交给外层容器。
   */
  maxHeightPx?: number;
};

/**
 * 从约一行高度起随内容增高，避免大段空白占位；默认不封顶，避免嵌套滚轮。
 */
export function AutoGrowTextarea({
  value,
  maxHeightPx,
  className = "",
  onChange,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
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
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      className={className}
      {...rest}
    />
  );
}
