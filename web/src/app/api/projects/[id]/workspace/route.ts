import { NextResponse } from "next/server";
import { parseScriptsFromTranscript } from "@/lib/transcript-scripts";
import {
  applyDemoLocaleSync,
  resolveAppLocaleForSync,
} from "@/lib/server/demo-locale-sync";
import { getAuthedSupabase } from "@/lib/server/require-auth";
import { isPostgresUndefinedColumn, QUESTIONS_SELECT_MINIMAL } from "@/lib/questions-compat";
import type { WorkspaceChatTurn } from "@/lib/client-session";

type Ctx = { params: Promise<{ id: string }> };

type QuestionRow = {
  id: string;
  round_index: number;
  title: string;
  source: string;
  sort_order: number;
  attachment_url: string | null;
  /** 仅当已执行 topic_category 迁移并由其它查询写入后才有；此处 SELECT 不依赖该列 */
  topic_category?: string | null;
};

function projectResponseSlice(project: {
  id: string;
  resume_text: string | null;
  jd_text: string | null;
  analysis_jsonb: unknown;
  rounds_count: number | null;
  active_round: number | null;
  transcript_text: string | null;
}) {
  return {
    id: project.id,
    resume_text: project.resume_text,
    jd_text: project.jd_text,
    analysis_jsonb: project.analysis_jsonb,
    rounds_count: project.rounds_count,
    active_round: project.active_round,
    transcript_text: project.transcript_text,
  };
}

function mapQuestionRows(list: QuestionRow[]) {
  return list.map((q) => ({
    id: q.id,
    round: q.round_index,
    title: q.title,
    source: q.source,
    imagePreview: q.attachment_url ?? undefined,
    topicCategory: q.topic_category ?? undefined,
  }));
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const queryLocale = new URL(req.url).searchParams.get("locale");

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .maybeSingle();
  const appLocale = resolveAppLocaleForSync(
    queryLocale,
    profile?.locale as string | null | undefined,
  );
  await applyDemoLocaleSync(supabase, appLocale, project, null);

  const q1 = await supabase
    .from("questions")
    .select(`${QUESTIONS_SELECT_MINIMAL}, topic_category`)
    .eq("project_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  let questions: QuestionRow[] | null = q1.data as QuestionRow[] | null;
  let qErr = q1.error;

  if (qErr && isPostgresUndefinedColumn(qErr)) {
    const r2 = await supabase
      .from("questions")
      .select(QUESTIONS_SELECT_MINIMAL)
      .eq("project_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    questions = r2.data as QuestionRow[] | null;
    qErr = r2.error;
  }

  const scriptByIdBase = parseScriptsFromTranscript(project.transcript_text ?? "");

  if (qErr) {
    /** 仍带上 project，避免客户端因缺少 project 误判并立刻跳回准备页 */
    return NextResponse.json(
      {
        error: "questions_failed",
        message: qErr.message,
        project: projectResponseSlice(project),
        questions: [] as ReturnType<typeof mapQuestionRows>,
        chatById: {} as Record<string, WorkspaceChatTurn[]>,
        scriptById: scriptByIdBase,
      },
      { status: 500 },
    );
  }

  const qList = (questions ?? []) as QuestionRow[];
  await applyDemoLocaleSync(supabase, appLocale, project, qList);

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
    return NextResponse.json(
      {
        error: "messages_failed",
        message: mErr.message,
        project: projectResponseSlice(project),
        questions: mapQuestionRows(qList),
        chatById: {} as Record<string, WorkspaceChatTurn[]>,
        scriptById: scriptByIdBase,
      },
      { status: 500 },
    );
  }

  const chatById: Record<string, WorkspaceChatTurn[]> = {};
  for (const m of messages ?? []) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const arr = chatById[m.question_id] ?? [];
    arr.push({ role: m.role, content: m.content ?? "" });
    chatById[m.question_id] = arr;
  }

  return NextResponse.json({
    project: projectResponseSlice(project),
    questions: mapQuestionRows(qList),
    chatById,
    scriptById: scriptByIdBase,
  });
}
