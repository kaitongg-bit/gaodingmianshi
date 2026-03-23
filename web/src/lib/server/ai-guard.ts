import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AiCreditReason =
  | "ai_analyze"
  | "ai_questions"
  | "ai_chat"
  | "ai_extract_questions";

/**
 * 已登录用户扣积分；未登录 401；余额不足 402。
 */
export async function consumeCreditsForAi(reason: AiCreditReason, amount = 1) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false as const, status: 401 as const, message: "unauthorized" };
  }

  const { data: consumed, error: rpcErr } = await supabase.rpc("consume_credits", {
    p_amount: amount,
    p_reason: reason,
  });

  if (rpcErr) {
    return { ok: false as const, status: 500 as const, message: rpcErr.message };
  }
  if (!consumed) {
    return { ok: false as const, status: 402 as const, message: "insufficient_credits" };
  }

  return { ok: true as const, user };
}
