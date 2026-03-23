import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/server/require-auth";

type Ctx = { params: Promise<{ id: string }> };

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

/** 单条添加（用户自拟题等） */
export async function POST(req: Request, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await assertProjectOwner(supabase, projectId, user.id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    title?: string;
    round?: number;
    round_index?: number;
    source?: "ai" | "user";
    attachment_url?: string | null;
    sort_order?: number;
  };

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }

  const round = Math.max(1, Math.floor(Number(body.round ?? body.round_index) || 1));
  const source = body.source === "ai" ? "ai" : "user";
  const attachment_url =
    typeof body.attachment_url === "string" && body.attachment_url.length < 12_000
      ? body.attachment_url
      : null;

  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const sort_order =
    typeof body.sort_order === "number" && Number.isFinite(body.sort_order)
      ? body.sort_order
      : (count ?? 0);

  const { data, error } = await supabase
    .from("questions")
    .insert({
      project_id: projectId,
      round_index: round,
      title,
      source,
      sort_order,
      attachment_url,
    })
    .select("id, round_index, title, source, attachment_url")
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    question: {
      id: data.id,
      round: data.round_index,
      title: data.title,
      source: data.source,
      imagePreview: data.attachment_url ?? undefined,
    },
  });
}

/** 替换 AI 题目：删除该项目下 source=ai 的题目，再批量插入 */
export async function PUT(req: Request, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await assertProjectOwner(supabase, projectId, user.id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    questions?: { title: string; round: number }[];
  };

  const items = Array.isArray(body.questions) ? body.questions : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "questions_required" }, { status: 400 });
  }

  const { error: delErr } = await supabase
    .from("questions")
    .delete()
    .eq("project_id", projectId)
    .eq("source", "ai");

  if (delErr) {
    return NextResponse.json({ error: "delete_failed", message: delErr.message }, { status: 500 });
  }

  const rows = items.map((q, i) => ({
    project_id: projectId,
    round_index: Math.max(1, Math.floor(Number(q.round) || 1)),
    title: String(q.title ?? "").trim() || "Question",
    source: "ai" as const,
    sort_order: i,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("questions")
    .insert(rows)
    .select("id, round_index, title, source, attachment_url");

  if (insErr) {
    return NextResponse.json({ error: "insert_failed", message: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    questions: (inserted ?? []).map((q) => ({
      id: q.id,
      round: q.round_index,
      title: q.title,
      imagePreview: q.attachment_url ?? undefined,
    })),
  });
}
