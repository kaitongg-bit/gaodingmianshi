import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/server/require-auth";

const MAX_BODY = 8000;

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

  const { error } = await supabase.from("support_feedback").insert({
    user_id: user.id,
    category,
    body: text,
  });

  if (error) {
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
