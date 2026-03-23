import { NextResponse } from "next/server";
import { normalizeQuestionTopic } from "@/lib/question-topics";
import { isPostgresUndefinedColumn, QUESTIONS_SELECT_MINIMAL } from "@/lib/questions-compat";
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

  let body: {
    round?: number;
    items?: {
      title?: string;
      topic_category?: string | null;
      attachment_url?: string | null;
    }[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0 || items.length > 40) {
    return NextResponse.json({ error: "items_required" }, { status: 400 });
  }

  const round = Math.max(1, Math.floor(Number(body.round) || 1));

  const { count, error: cErr } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (cErr) {
    return NextResponse.json({ error: "count_failed", message: cErr.message }, { status: 500 });
  }

  const baseSort = count ?? 0;
  const rows = items.map((it, i) => {
    const title = String(it.title ?? "").trim();
    const attachment_url =
      typeof it.attachment_url === "string" && it.attachment_url.length < 12_000
        ? it.attachment_url
        : null;
    const topic_category = normalizeQuestionTopic(
      typeof it.topic_category === "string" ? it.topic_category : undefined,
    );
    return {
      project_id: projectId,
      round_index: round,
      title: title || `Question ${i + 1}`,
      source: "user" as const,
      sort_order: baseSort + i,
      attachment_url,
      topic_category,
    };
  });

  type InsertedRow = {
    id: string;
    round_index: number;
    title: string;
    source: string;
    sort_order: number;
    attachment_url: string | null;
    topic_category?: string | null;
  };

  let inserted: InsertedRow[] | null = null;
  let { data: insertedData, error: insErr } = await supabase
    .from("questions")
    .insert(rows)
    .select(`${QUESTIONS_SELECT_MINIMAL}, topic_category`);

  if (insErr && isPostgresUndefinedColumn(insErr)) {
    const rowsLegacy = rows.map(({ topic_category: _t, ...rest }) => rest);
    const r2 = await supabase
      .from("questions")
      .insert(rowsLegacy)
      .select(QUESTIONS_SELECT_MINIMAL);
    inserted = r2.data as InsertedRow[] | null;
    insErr = r2.error;
  } else {
    inserted = insertedData as InsertedRow[] | null;
  }

  if (insErr) {
    return NextResponse.json({ error: "insert_failed", message: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    questions: (inserted ?? []).map((q) => ({
      id: q.id,
      round: q.round_index,
      title: q.title,
      source: q.source,
      imagePreview: q.attachment_url ?? undefined,
      topicCategory: (q as { topic_category?: string | null }).topic_category ?? undefined,
    })),
  });
}
