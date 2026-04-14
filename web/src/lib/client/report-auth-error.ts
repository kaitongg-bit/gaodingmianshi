"use client";

const MAX_MSG_LEN = 300;

function truncate(input: string, max = MAX_MSG_LEN): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}...(truncated)`;
}

export function reportAuthError(input: {
  source:
    | "login_password"
    | "register_password"
    | "oauth_start"
    | "oauth_callback"
    | "forgot_password";
  reason?: string;
  message?: string;
  emailHint?: string;
}): void {
  const payload = {
    source: input.source,
    reason: input.reason,
    message: input.message ? truncate(input.message) : undefined,
    emailHint: input.emailHint ? truncate(input.emailHint, 120) : undefined,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
  };

  void fetch("/api/auth/error-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

