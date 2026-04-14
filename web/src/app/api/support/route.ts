import { NextResponse } from "next/server";
import { notifyFeishuAlert } from "@/lib/server/notify-feishu";
import { notifySupportInbox } from "@/lib/server/notify-support-inbox";
import { getAuthedSupabase } from "@/lib/server/require-auth";
import { createSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { SUPPORT_FEEDBACK_BONUS_CREDITS } from "@/lib/support-feedback-bonus";

const MAX_BODY = 8000;
const FEISHU_FEEDBACK_PREVIEW_MAX = 1000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}...(truncated)`;
}

export async function POST(req: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { category?: string; body?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const category = body.category === "bug" ? "bug" : body.category === "feedback" ? "feedback" : null;
  if (!category) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text.length) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: "body_too_long" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("support_feedback")
    .insert({
      user_id: user.id,
      category,
      body: text,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 });
  }

  const feedbackId = row?.id as string | undefined;

  let creditsGranted = 0;
  let creditsBalance: number | null = null;
  type BonusState = "disabled" | "granted" | "cooldown" | "error";
  let bonusState: BonusState = "disabled";

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data: bonusBal, error: bonusErr } = await admin.rpc("try_grant_support_feedback_bonus", {
      p_user_id: user.id,
      p_amount: SUPPORT_FEEDBACK_BONUS_CREDITS,
    });

    if (bonusErr) {
      bonusState = "error";
      console.warn("[support] bonus rpc:", bonusErr.message);
    } else if (typeof bonusBal === "number") {
      if (bonusBal >= 0) {
        creditsGranted = SUPPORT_FEEDBACK_BONUS_CREDITS;
        creditsBalance = bonusBal;
        bonusState = "granted";
      } else {
        bonusState = "cooldown";
      }
    } else {
      bonusState = "error";
    }
  }

  const userEmail = user.email ?? "—";
  const catLabel = category === "bug" ? "Bug" : "Feedback";
  void notifySupportInbox({
    subject: `[DraftReady] ${catLabel} · ${userEmail}`,
    html: `
      <p><strong>Category:</strong> ${escapeHtml(category)}</p>
      <p><strong>User id:</strong> ${escapeHtml(user.id)}</p>
      <p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
      ${feedbackId ? `<p><strong>Row id:</strong> ${escapeHtml(feedbackId)}</p>` : ""}
      <p><strong>Auto bonus:</strong> ${bonusState === "granted" ? `+${creditsGranted} credits (new balance ${creditsBalance})` : bonusState}</p>
      <hr />
      <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(text)}</pre>
    `.trim(),
  });
  void notifyFeishuAlert({
    title: "New support feedback submitted",
    level: category === "bug" ? "warning" : "info",
    tags: {
      category,
      userId: user.id,
      userEmail,
      feedbackId,
      bonusState,
      creditsGranted,
    },
    details: truncateText(text, FEISHU_FEEDBACK_PREVIEW_MAX),
  });

  return NextResponse.json({
    ok: true,
    creditsGranted,
    creditsBalance: creditsBalance ?? undefined,
    bonusState,
  });
}
