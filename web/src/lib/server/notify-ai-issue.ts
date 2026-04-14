import {
  isLikelyQuotaError,
  notifyFeishuAlert,
  type FeishuAlertLevel,
} from "@/lib/server/notify-feishu";

export async function notifyAiIssue(
  route: string,
  error: unknown,
  extras?: Record<string, string | number | boolean | undefined>,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const level: FeishuAlertLevel = isLikelyQuotaError(message) ? "warning" : "error";
  const title = isLikelyQuotaError(message)
    ? "AI quota / rate-limit warning"
    : "AI API failure";

  await notifyFeishuAlert({
    title,
    level,
    tags: {
      source: route,
      ...extras,
    },
    details: message,
  });
}

