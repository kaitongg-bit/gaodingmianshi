import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/server/require-auth";

type Ctx = { params: Promise<{ questionId: string }> };

async function assertQuestionOwned(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  questionId: string,
  userId: string,
) {
  const { data: q } = await supabase
    .from("questions")
    .select("project_id")
    .eq("id", questionId)
    .maybeSingle();
  if (!q?.project_id) return false;
  const { data: p } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", q.project_id)
    .maybeSingle();
  return Boolean(p && p.user_id === userId);
}

export async function POST(req: Request, ctx: Ctx) {
  const { questionId } = await ctx.params;
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const owned = await assertQuestionOwned(supabase, questionId, user.id);
  if (!owned) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await req.json()) as { role?: string; content?: string };
  const role = body.role === "assistant" ? "assistant" : "user";
  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "content_required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("question_messages")
    .insert({ question_id: questionId, role, content })
    .select("id, role, content")
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: data });
}
