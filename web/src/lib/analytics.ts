/**
 * 客户端埋点：写入 `window.dataLayer`（便于接 GTM / GA4），并在 Microsoft Clarity
 * 加载后调用 `clarity("event", name)`。Clarity 未加载时仍写 dataLayer；开发环境额外 console。
 *
 * 指标对照（在分析工具里用漏斗 / 自定义报告计算比例即可）：
 * - 订阅意向：`billing_paywall_view`
 * - 生成成功：`ai_analyze_success` | `ai_generate_questions_success` | `ai_chat_success` | `ai_extract_questions_success`
 * - 生成失败：对应的 `*_fail`
 * - 采纳（逐字稿）：`script_adopt`（source: full_reply | selection）
 * - 对话频次：`ai_chat_success` 的 `user_turn_index`（本题下累计用户发言轮次，含本次）
 * - 导出：`export_markdown`（source: workspace | question_bank）
 */

export type AnalyticsProps = Record<string, string | number | boolean | undefined | null>;

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

function toDataLayerPayload(name: string, props?: AnalyticsProps): Record<string, unknown> {
  const o: Record<string, unknown> = { event: name };
  if (!props) return o;
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined && v !== null) o[k] = v;
  }
  return o;
}

/** 仅发送可枚举错误码，避免把文案或 PII 打进分析 */
export function analyticsErrorCode(raw: string | undefined, fallback = "unknown"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const s = raw.trim().slice(0, 64);
  if (/^[a-z][a-z0-9_]*$/i.test(s)) return s;
  return fallback;
}

export function trackEvent(name: string, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;

  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push(toDataLayerPayload(name, props));
  } catch {
    /* ignore */
  }

  try {
    const clarity = window.clarity;
    if (typeof clarity === "function") {
      clarity("event", name);
    }
  } catch {
    /* ignore */
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", name, props ?? {});
  }
}
