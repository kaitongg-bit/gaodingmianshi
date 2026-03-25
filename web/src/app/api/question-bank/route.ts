import { NextResponse } from "next/server";
import type { AnalysisPayload } from "@/lib/client-session";
import { normalizeQuestionTopic } from "@/lib/question-topics";
import { isPostgresUndefinedColumn } from "@/lib/questions-compat";
import {
  deriveCompanyRoleFromMaterials,
  resolveProjectListTitle,
} from "@/lib/server/project-card";
import { getAuthedSupabase } from "@/lib/server/require-auth";

export async function GET(req: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "zh";

  const { data: projects, error: pErr } = await supabase
    .from("projects")
    .select("id, jd_text, display_title, analysis_jsonb")
    .eq("user_id", user.id)
    .eq("is_archived", false);

  if (pErr) {
    return NextResponse.json({ error: "list_failed", message: pErr.message }, { status: 500 });
  }

  const plist = projects ?? [];
  if (plist.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const projectMeta = new Map<string, { title: string }>();
  for (const p of plist) {
    const analysis = (p.analysis_jsonb ?? null) as AnalysisPayload | null;
    const { company } = deriveCompanyRoleFromMaterials(p.jd_text ?? "", analysis);
    const title = resolveProjectListTitle(
      p.display_title as string | null | undefined,
      p.jd_text ?? "",
      company,
      locale,
    );
    projectMeta.set(p.id, { title });
  }

  const projectIds = plist.map((p) => p.id);

  type QRow = {
    id: string;
    project_id: string;
    title: string;
    round_index: number;
    topic_category?: string | null;
  };

  let qRows: QRow[] = [];
  const q1 = await supabase
    .from("questions")
    .select("id, project_id, title, round_index, topic_category")
    .in("project_id", projectIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (q1.error && isPostgresUndefinedColumn(q1.error)) {
    const q2 = await supabase
      .from("questions")
      .select("id, project_id, title, round_index")
      .in("project_id", projectIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (q2.error) {
      return NextResponse.json(
        { error: "questions_failed", message: q2.error.message },
        { status: 500 },
      );
    }
    qRows = (q2.data ?? []).map((r) => ({ ...r, topic_category: null }));
  } else if (q1.error) {
    return NextResponse.json(
      { error: "questions_failed", message: q1.error.message },
      { status: 500 },
    );
  } else {
    qRows = (q1.data ?? []) as QRow[];
  }

  const qids = qRows.map((q) => q.id);
  if (qids.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data: msgs, error: mErr } = await supabase
    .from("question_messages")
    .select("question_id, role, content, created_at")
    .in("question_id", qids)
    .order("created_at", { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: "messages_failed", message: mErr.message }, { status: 500 });
  }

  const byQ = new Map<string, { role: string; content: string }[]>();
  for (const m of msgs ?? []) {
    const arr = byQ.get(m.question_id) ?? [];
    arr.push({ role: m.role, content: (m.content as string) ?? "" });
    byQ.set(m.question_id, arr);
  }

  const items: {
    id: string;
    projectId: string;
    projectTitle: string;
    round: number;
    topicCategory: string;
    title: string;
    answered: boolean;
    assistantExcerpt: string;
    userTurnCount: number;
  }[] = [];
  for (const q of qRows) {
    const turns = byQ.get(q.id) ?? [];
    const hasAssistant = turns.some((t) => t.role === "assistant");

    let lastAssistant = "";
    if (hasAssistant) {
      for (let i = turns.length - 1; i >= 0; i--) {
        if (turns[i].role === "assistant") {
          lastAssistant = turns[i].content;
          break;
        }
      }
    }

    const meta = projectMeta.get(q.project_id);
    const topicSlug = normalizeQuestionTopic(q.topic_category ?? undefined);

    items.push({
      id: q.id,
      projectId: q.project_id,
      projectTitle: meta?.title ?? q.project_id.slice(0, 8),
      round: q.round_index,
      topicCategory: topicSlug,
      title: q.title,
      answered: hasAssistant,
      assistantExcerpt: lastAssistant.slice(0, 500),
      userTurnCount: turns.filter((t) => t.role === "user").length,
    });
  }

  return NextResponse.json({ items });
}
