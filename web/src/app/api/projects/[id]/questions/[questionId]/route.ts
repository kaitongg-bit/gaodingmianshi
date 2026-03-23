import { NextResponse } from "next/server";
import { MAX_INTERVIEW_ROUNDS, MIN_INTERVIEW_ROUNDS } from "@/lib/project-rounds";
import { normalizeQuestionTopic } from "@/lib/question-topics";
import { isPostgresUndefinedColumn, QUESTIONS_SELECT_MINIMAL } from "@/lib/questions-compat";
import { getAuthedSupabase } from "@/lib/server/require-auth";

type Ctx = { params: Promise<{ id: string; questionId: string }> };

async function assertProjectOwner(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  projectId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  return Boolean(data && data.user_id === userId);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id: projectId, questionId } = await ctx.params;
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await assertProjectOwner(supabase, projectId, user.id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: {
    title?: string;
    round?: number;
    move?: "up" | "down";
    topic_category?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { data: row, error: qErr } = await supabase
    .from("questions")
    .select("id, project_id, round_index, sort_order")
    .eq("id", questionId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (qErr || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (body.move === "up" || body.move === "down") {
    const { data: siblings, error: sErr } = await supabase
      .from("questions")
      .select("id, sort_order, created_at")
      .eq("project_id", projectId)
      .eq("round_index", row.round_index)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (sErr) {
      return NextResponse.json({ error: "list_failed", message: sErr.message }, { status: 500 });
    }

    const list = siblings ?? [];
    const idx = list.findIndex((q) => q.id === questionId);
    if (idx < 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const swapIdx = body.move === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) {
      return NextResponse.json({ ok: true, question: { id: row.id, round: row.round_index, noop: true } });
    }

    const a = list[idx];
    const b = list[swapIdx];
    const sa = a.sort_order;
    const sb = b.sort_order;

    const temp = -999999 - Math.floor(Math.random() * 1e6);
    const { error: e1 } = await supabase.from("questions").update({ sort_order: temp }).eq("id", a.id);
    if (e1) {
      return NextResponse.json({ error: "update_failed", message: e1.message }, { status: 500 });
    }
    const { error: e2 } = await supabase.from("questions").update({ sort_order: sa }).eq("id", b.id);
    if (e2) {
      await supabase.from("questions").update({ sort_order: sa }).eq("id", a.id);
      return NextResponse.json({ error: "update_failed", message: e2.message }, { status: 500 });
    }
    const { error: e3 } = await supabase.from("questions").update({ sort_order: sb }).eq("id", a.id);
    if (e3) {
      return NextResponse.json({ error: "update_failed", message: e3.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      question: { id: row.id, round: row.round_index, moved: body.move },
    });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) {
      return NextResponse.json({ error: "title_required" }, { status: 400 });
    }
    patch.title = t;
  }
  if (typeof body.round === "number" && Number.isFinite(body.round)) {
    patch.round_index = Math.min(
      MAX_INTERVIEW_ROUNDS,
      Math.max(MIN_INTERVIEW_ROUNDS, Math.floor(body.round)),
    );
  }
  if (body.topic_category !== undefined) {
    if (body.topic_category === null) {
      patch.topic_category = null;
    } else if (typeof body.topic_category === "string") {
      patch.topic_category = normalizeQuestionTopic(body.topic_category);
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  type QuestionRowOut = {
    id: string;
    round_index: number;
    title: string;
    source: string;
    attachment_url: string | null;
    topic_category?: string | null;
  };

  async function doUpdate(
    p: Record<string, unknown>,
    selectCols: string,
  ): Promise<{ data: QuestionRowOut | null; error: { message: string; code?: string } | null }> {
    const r = await supabase
      .from("questions")
      .update(p)
      .eq("id", questionId)
      .eq("project_id", projectId)
      .select(selectCols)
      .single();
    return { data: r.data as QuestionRowOut | null, error: r.error };
  }

  let { data: updated, error: uErr } = await doUpdate(
    patch,
    `${QUESTIONS_SELECT_MINIMAL}, topic_category`,
  );

  if (uErr && isPostgresUndefinedColumn(uErr)) {
    const { topic_category: _tc, ...rest } = patch;
    if (Object.keys(rest).length === 0 && patch.topic_category !== undefined) {
      return NextResponse.json(
        {
          error: "topic_category_unavailable",
          message:
            "Database is missing column topic_category. Apply migration 20250325130000_question_topic_category.sql in Supabase.",
        },
        { status: 400 },
      );
    }
    const legacyPatch = Object.keys(rest).length > 0 ? rest : patch;
    const r2 = await doUpdate(legacyPatch, QUESTIONS_SELECT_MINIMAL);
    updated = r2.data;
    uErr = r2.error;
  }

  if (uErr) {
    return NextResponse.json({ error: "update_failed", message: uErr.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    question: {
      id: updated.id,
      round: updated.round_index,
      title: updated.title,
      source: updated.source,
      imagePreview: updated.attachment_url ?? undefined,
      topicCategory: (updated as { topic_category?: string | null }).topic_category ?? undefined,
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id: projectId, questionId } = await ctx.params;
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await assertProjectOwner(supabase, projectId, user.id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId)
    .eq("project_id", projectId);

  if (error) {
    return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
