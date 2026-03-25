import { NextResponse } from "next/server";
import { clampRoundsCount } from "@/lib/project-rounds";
import {
  deriveCompanyRoleFromMaterials,
  formatProjectDate,
  resolveDemoProjectRole,
  resolveProjectListTitle,
} from "@/lib/server/project-card";
import { getAuthedSupabase } from "@/lib/server/require-auth";
import type { AnalysisPayload } from "@/lib/client-session";

export async function GET(req: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "zh";

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, jd_text, resume_text, analysis_jsonb, updated_at, rounds_count, display_title")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "list_failed", message: error.message }, { status: 500 });
  }

  const list = projects ?? [];
  if (list.length === 0) {
    return NextResponse.json({ projects: [] });
  }

  const ids = list.map((p) => p.id);
  const { data: questions } = await supabase.from("questions").select("id, project_id").in("project_id", ids);

  const qRows = questions ?? [];
  const qids = qRows.map((q) => q.id);
  const byProject = new Map<string, string[]>();
  for (const q of qRows) {
    const arr = byProject.get(q.project_id) ?? [];
    arr.push(q.id);
    byProject.set(q.project_id, arr);
  }

  let assistantByQuestion = new Set<string>();
  if (qids.length > 0) {
    const { data: msgs } = await supabase
      .from("question_messages")
      .select("question_id")
      .in("question_id", qids)
      .eq("role", "assistant");
    assistantByQuestion = new Set((msgs ?? []).map((m) => m.question_id));
  }

  const cards = list.map((p) => {
    const analysis = (p.analysis_jsonb ?? null) as AnalysisPayload | null;
    const { company, role } = deriveCompanyRoleFromMaterials(p.jd_text ?? "", analysis);
    const title = resolveProjectListTitle(p.display_title, p.jd_text ?? "", company, locale);
    const roleLabel = resolveDemoProjectRole(p.jd_text ?? "", role, locale);
    const qForP = byProject.get(p.id) ?? [];
    const total = qForP.length;
    const answered = total === 0 ? 0 : qForP.filter((qid) => assistantByQuestion.has(qid)).length;
    const progress = total === 0 ? 0 : Math.min(100, Math.round((answered / total) * 100));

    return {
      id: p.id,
      title,
      role: roleLabel,
      date: formatProjectDate(p.updated_at, locale),
      progress,
      updatedAt: new Date(p.updated_at).getTime(),
    };
  });

  return NextResponse.json({ projects: cards });
}

export async function POST(req: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    resume_text?: string;
    jd_text?: string;
    rounds_count?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body */
  }

  const resume_text = (body.resume_text ?? "").trim();
  const jd_text = (body.jd_text ?? "").trim();
  const rounds_count = clampRoundsCount(Number(body.rounds_count) || 3);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      resume_text,
      jd_text,
      rounds_count,
      active_round: 1,
      is_system_template: false,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "create_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
