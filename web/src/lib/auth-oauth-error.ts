/** 与 /auth/callback 的 ?reason= 对应 */
export type OAuthCallbackReason =
  | "missing_code"
  | "pkce"
  | "redirect"
  | "expired"
  | "unknown";

export function classifyExchangeError(message: string): OAuthCallbackReason {
  const m = message.toLowerCase();
  if (m.includes("code verifier") || m.includes("verifier") || m.includes("non-empty")) {
    return "pkce";
  }
  if (m.includes("redirect_uri") || (m.includes("redirect") && m.includes("uri"))) {
    return "redirect";
  }
  if (m.includes("expired") || m.includes("invalid_grant")) {
    return "expired";
  }
  return "unknown";
}

export function messageForOAuthCallbackReason(
  reason: string | null,
  t: (key: string) => string,
): string {
  switch (reason) {
    case "pkce":
      return t("oauthFailedPkce");
    case "redirect":
      return t("oauthFailedRedirect");
    case "expired":
      return t("oauthFailedExpired");
    case "missing_code":
      return t("oauthFailedMissingCode");
    default:
      return t("oauthFailedUnknown");
  }
}
