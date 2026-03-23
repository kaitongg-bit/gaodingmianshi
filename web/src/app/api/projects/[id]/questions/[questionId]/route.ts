import { NextResponse } from "next/server";
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
    patch.round_index = Math.min(5, Math.max(1, Math.floor(body.round)));
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  const { data: updated, error: uErr } = await supabase
    .from("questions")
    .update(patch)
    .eq("id", questionId)
    .eq("project_id", projectId)
    .select("id, round_index, title, source, attachment_url")
    .single();

  if (uErr) {
    return NextResponse.json({ error: "update_failed", message: uErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    question: {
      id: updated.id,
      round: updated.round_index,
      title: updated.title,
      source: updated.source,
      imagePreview: updated.attachment_url ?? undefined,
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
