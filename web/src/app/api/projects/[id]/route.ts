import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/server/require-auth";

type Ctx = { params: Promise<{ id: string }> };

async function assertProjectOwner(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  projectId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data || data.user_id !== userId) {
    return false;
  }
  return true;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await assertProjectOwner(supabase, id, user.id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, resume_text, jd_text, analysis_jsonb, rounds_count, active_round, transcript_text, updated_at, display_title",
    )
    .eq("id", id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { count, error: countErr } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id);

  if (countErr) {
    return NextResponse.json({ error: "count_failed", message: countErr.message }, { status: 500 });
  }

  return NextResponse.json({
    project: {
      ...project,
      question_count: count ?? 0,
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await assertProjectOwner(supabase, id, user.id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: {
    resume_text?: string;
    jd_text?: string;
    analysis_jsonb?: unknown;
    rounds_count?: number;
    active_round?: number;
    transcript_text?: string;
    display_title?: string | null;
    /** 仅当当前 display_title 为空时写入（如分析后自动建议短标题） */
    display_title_if_empty?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.resume_text === "string") patch.resume_text = body.resume_text;
  if (typeof body.jd_text === "string") patch.jd_text = body.jd_text;
  if (body.analysis_jsonb !== undefined) patch.analysis_jsonb = body.analysis_jsonb;
  if (typeof body.rounds_count === "number" && Number.isFinite(body.rounds_count)) {
    patch.rounds_count = Math.min(5, Math.max(1, Math.floor(body.rounds_count)));
  }
  if (typeof body.active_round === "number" && Number.isFinite(body.active_round)) {
    patch.active_round = Math.max(1, Math.floor(body.active_round));
  }
  if (typeof body.transcript_text === "string") patch.transcript_text = body.transcript_text;
  if (body.display_title !== undefined) {
    if (body.display_title === null) {
      patch.display_title = null;
    } else if (typeof body.display_title === "string") {
      const v = body.display_title.trim();
      patch.display_title = v.length ? v.slice(0, 200) : null;
    }
  }
  if (typeof body.display_title_if_empty === "string") {
    const v = body.display_title_if_empty.trim().slice(0, 200);
    if (v.length) {
      const { data: row } = await supabase
        .from("projects")
        .select("display_title")
        .eq("id", id)
        .maybeSingle();
      const cur = ((row?.display_title as string | null) ?? "").trim();
      if (!cur) {
        patch.display_title = v;
      }
    }
  }

  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
