import { NextResponse } from "next/server";
import { notifyFeishuAlert } from "@/lib/server/notify-feishu";

const ALLOWED_SOURCES = new Set([
  "login_password",
  "register_password",
  "oauth_start",
  "oauth_callback",
  "forgot_password",
]);

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}...(truncated)`;
}

export async function POST(req: Request) {
  let body: {
    source?: string;
    reason?: string;
    message?: string;
    emailHint?: string;
    path?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const source =
    typeof body.source === "string" && ALLOWED_SOURCES.has(body.source)
      ? body.source
      : null;
  if (!source) {
    return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? truncate(body.reason.trim(), 100) : undefined;
  const message =
    typeof body.message === "string" ? truncate(body.message.trim(), 500) : undefined;
  const emailHint =
    typeof body.emailHint === "string" ? truncate(body.emailHint.trim().toLowerCase(), 120) : undefined;
  const path = typeof body.path === "string" ? truncate(body.path.trim(), 120) : undefined;

  const ipHeader = req.headers.get("x-forwarded-for") ?? "";
  const ip = ipHeader.split(",")[0]?.trim() || undefined;

  void notifyFeishuAlert({
    title: "Auth error reported by client",
    level: "warning",
    tags: {
      source,
      reason,
      emailHint,
      path,
      ip,
    },
    details: message,
  });

  return NextResponse.json({ ok: true });
}

