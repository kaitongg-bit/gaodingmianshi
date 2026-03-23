import { NextResponse } from "next/server";
import { parseScriptsFromTranscript } from "@/lib/transcript-scripts";
import { getAuthedSupabase } from "@/lib/server/require-auth";
import type { WorkspaceChatTurn } from "@/lib/client-session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select(
      "id, user_id, resume_text, jd_text, analysis_jsonb, rounds_count, active_round, transcript_text",
    )
    .eq("id", id)
    .maybeSingle();

  if (pErr || !project || project.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id, round_index, title, source, sort_order, attachment_url")
    .eq("project_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (qErr) {
    return NextResponse.json({ error: "questions_failed", message: qErr.message }, { status: 500 });
  }

  const qList = questions ?? [];
  const qids = qList.map((q) => q.id);

  const { data: messages, error: mErr } =
    qids.length === 0
      ? { data: [] as { question_id: string; role: string; content: string }[], error: null }
      : await supabase
          .from("question_messages")
          .select("question_id, role, content")
          .in("question_id", qids)
          .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: "messages_failed", message: mErr.message }, { status: 500 });
  }

  const chatById: Record<string, WorkspaceChatTurn[]> = {};
  for (const m of messages ?? []) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const arr = chatById[m.question_id] ?? [];
    arr.push({ role: m.role, content: m.content ?? "" });
    chatById[m.question_id] = arr;
  }

  const scriptById = parseScriptsFromTranscript(project.transcript_text ?? "");

  return NextResponse.json({
    project: {
      id: project.id,
      resume_text: project.resume_text,
      jd_text: project.jd_text,
      analysis_jsonb: project.analysis_jsonb,
      rounds_count: project.rounds_count,
      active_round: project.active_round,
      transcript_text: project.transcript_text,
    },
    questions: qList.map((q) => ({
      id: q.id,
      round: q.round_index,
      title: q.title,
      source: q.source,
      imagePreview: q.attachment_url ?? undefined,
    })),
    chatById,
    scriptById,
  });
}
