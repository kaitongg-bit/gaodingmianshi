import { NextResponse } from "next/server";
import { clampRoundsCount } from "@/lib/project-rounds";
import { GeminiConfigError } from "@/lib/gemini";
import { consumeCreditsForAi } from "@/lib/server/ai-guard";
import { runInterviewQuestionGeneration } from "@/lib/server/ai-questions-core";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      resume?: string;
      jd?: string;
      locale?: string;
      rounds?: number;
      extraHint?: string;
      analysis?: unknown;
      existingQuestionTitles?: unknown;
    };
    const resume = (body.resume ?? "").trim();
    const jd = (body.jd ?? "").trim();
    const locale = body.locale === "en" ? "en" : "zh";
    const rounds = clampRoundsCount(Number(body.rounds) || 3);
    const extraHint = (body.extraHint ?? "").trim();
    const analysis = body.analysis;

    const existingTitles = Array.isArray(body.existingQuestionTitles)
      ? body.existingQuestionTitles
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 120)
      : [];

    if (!resume || !jd) {
      return NextResponse.json(
        { error: "resume_and_jd_required" },
        { status: 400 },
      );
    }

    const credit = await consumeCreditsForAi("ai_questions", 10);
    if (!credit.ok) {
      return NextResponse.json(
        { error: credit.message },
        { status: credit.status },
      );
    }

    const questions = await runInterviewQuestionGeneration({
      resume,
      jd,
      locale,
      rounds,
      extraHint: extraHint || undefined,
      analysis,
      existingQuestionTitles: existingTitles,
    });

    if (questions.length === 0) {
      return NextResponse.json({ error: "empty_questions" }, { status: 422 });
    }

    return NextResponse.json({ ok: true, questions });
  } catch (e) {
    if (e instanceof GeminiConfigError) {
      return NextResponse.json(
        { error: "missing_api_key", message: e.message },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json(
      { error: "questions_failed", message },
      { status: 500 },
    );
  }
}
