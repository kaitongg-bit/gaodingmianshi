const FEISHU_TIMEOUT_MS = 5000;
const FEISHU_TEXT_MAX = 3500;

export type FeishuAlertLevel = "info" | "warning" | "error";

const LEVEL_EMOJI: Record<FeishuAlertLevel, string> = {
  info: "ℹ️",
  warning: "⚠️",
  error: "🚨",
};

function truncate(text: string, max = FEISHU_TEXT_MAX): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...(truncated)`;
}

function sanitizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function getFeishuWebhookUrl(): string | undefined {
  const v = process.env.FEISHU_BOT_WEBHOOK_URL?.trim();
  return v || undefined;
}

export function isLikelyQuotaError(message: string): boolean {
  return /quota|rate.?limit|too many requests|resource has been exhausted|429|exceed/i.test(
    message,
  );
}

export async function notifyFeishuAlert(input: {
  title: string;
  level?: FeishuAlertLevel;
  details?: string;
  tags?: Record<string, string | number | boolean | undefined>;
}): Promise<void> {
  const webhook = getFeishuWebhookUrl();
  if (!webhook) return;

  const level = input.level ?? "info";
  const tags = Object.entries(input.tags ?? {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
    .map(([key, value]) => `${key}: ${String(value)}`);
  const details = input.details ? sanitizeText(input.details) : "";
  const text = truncate(
    [
      `${LEVEL_EMOJI[level]} [${level.toUpperCase()}] ${input.title}`,
      `time: ${new Date().toISOString()}`,
      ...tags,
      details ? `\n${details}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FEISHU_TIMEOUT_MS);
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msg_type: "text",
          content: { text },
        }),
        signal: controller.signal,
      });
      if (!r.ok) {
        const responseText = await r.text().catch(() => "");
        console.warn(
          "[feishu notify] request failed:",
          r.status,
          responseText.slice(0, 500),
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[feishu notify] error:", message);
  }
}

