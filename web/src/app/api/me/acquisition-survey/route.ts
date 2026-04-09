import { NextResponse } from "next/server";
import { isAcquisitionSurveyChannel } from "@/lib/acquisition-survey-bonus";
import { getAuthedSupabase } from "@/lib/server/require-auth";

export async function GET() {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_acquisition_survey")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "fetch_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { completed: data != null },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function POST(req: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { channel?: string; otherDetail?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const channel = typeof body.channel === "string" ? body.channel.trim().toLowerCase() : "";
  if (!isAcquisitionSurveyChannel(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }

  const otherDetail =
    typeof body.otherDetail === "string" ? body.otherDetail : "";

  const { data: newBalance, error } = await supabase.rpc("complete_acquisition_survey", {
    p_channel: channel,
    p_other_detail: otherDetail,
  });

  if (error) {
    return NextResponse.json(
      { error: "rpc_failed", message: error.message },
      { status: 500 },
    );
  }

  if (typeof newBalance !== "number") {
    return NextResponse.json({ error: "unexpected_response" }, { status: 500 });
  }

  if (newBalance === -1) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  if (newBalance === -2) {
    return NextResponse.json({ error: "already_completed" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, creditsBalance: newBalance });
}
