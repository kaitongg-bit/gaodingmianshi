import { NextResponse } from "next/server";
import { clampRoundsCount, MIN_INTERVIEW_ROUNDS } from "@/lib/project-rounds";
import { getAuthedSupabase } from "@/lib/server/require-auth";

type Ctx = { params: Promise<{ id: string; round: string }> };

async function assertProjectOwner(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  projectId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("projects")
    .select("id, user_id, rounds_count, active_round")
    .eq("id", projectId)
    .maybeSingle();
  return data && data.user_id === userId ? data : null;
}

/** 删除一整轮：删掉该轮全部题目，其后轮次题号前移，rounds_count 减一 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id: projectId, round: roundParam } = await ctx.params;
  const round = Math.floor(Number(roundParam) || 0);
  if (!Number.isFinite(round) || round < 1) {
    return NextResponse.json({ error: "invalid_round" }, { status: 400 });
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const project = await assertProjectOwner(supabase, projectId, user.id);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const roundsCount = clampRoundsCount(Number(project.rounds_count) || MIN_INTERVIEW_ROUNDS);
  if (round > roundsCount) {
    return NextResponse.json({ error: "round_out_of_range" }, { status: 400 });
  }
  if (roundsCount <= MIN_INTERVIEW_ROUNDS) {
    return NextResponse.json({ error: "cannot_remove_last_round" }, { status: 400 });
  }

  const { error: delErr } = await supabase
    .from("questions")
    .delete()
    .eq("project_id", projectId)
    .eq("round_index", round);

  if (delErr) {
    return NextResponse.json(
      { error: "delete_questions_failed", message: delErr.message },
      { status: 500 },
    );
  }

  const { data: toShift, error: listErr } = await supabase
    .from("questions")
    .select("id, round_index")
    .eq("project_id", projectId)
    .gt("round_index", round);

  if (listErr) {
    return NextResponse.json(
      { error: "list_shift_failed", message: listErr.message },
      { status: 500 },
    );
  }

  for (const row of toShift ?? []) {
    const { error: uErr } = await supabase
      .from("questions")
      .update({ round_index: row.round_index - 1 })
      .eq("id", row.id);
    if (uErr) {
      return NextResponse.json(
        { error: "shift_round_failed", message: uErr.message },
        { status: 500 },
      );
    }
  }

  const newRoundsCount = roundsCount - 1;
  let activeRound = Math.max(1, Math.floor(Number(project.active_round) || 1));
  if (activeRound === round) {
    activeRound = Math.max(1, round - 1);
  } else if (activeRound > round) {
    activeRound -= 1;
  }
  activeRound = Math.min(newRoundsCount, Math.max(1, activeRound));

  const { error: pErr } = await supabase
    .from("projects")
    .update({
      rounds_count: newRoundsCount,
      active_round: activeRound,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (pErr) {
    return NextResponse.json(
      { error: "project_update_failed", message: pErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    rounds_count: newRoundsCount,
    active_round: activeRound,
  });
}
