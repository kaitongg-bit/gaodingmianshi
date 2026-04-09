import { NextResponse } from "next/server";
import { clampRoundsCount } from "@/lib/project-rounds";
import { GeminiConfigError } from "@/lib/gemini";
import { consumeCreditsForAi } from "@/lib/server/ai-guard";
import { runResumeJdAnalysis } from "@/lib/server/ai-analyze-core";
import { runInterviewQuestionGeneration } from "@/lib/server/ai-questions-core";

/** 分析 + 出题串联；Vercel 等平台请保证上限 ≥ 180s */
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      resume?: string;
      jd?: string;
      locale?: string;
      rounds?: number;
      extraHint?: string;
      existingQuestionTitles?: unknown;
    };
    const resume = (body.resume ?? "").trim();
    const jd = (body.jd ?? "").trim();
    const locale = body.locale === "en" ? "en" : "zh";
    const rounds = clampRoundsCount(Number(body.rounds) || 3);
    const extraHint = (body.extraHint ?? "").trim();
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

    const creditAnalyze = await consumeCreditsForAi("ai_analyze", 1);
    if (!creditAnalyze.ok) {
      return NextResponse.json(
        { error: creditAnalyze.message },
        { status: creditAnalyze.status },
      );
    }

    let analysisData: unknown;
    try {
      analysisData = await runResumeJdAnalysis({ resume, jd, locale });
    } catch (e) {
      if (e instanceof GeminiConfigError) {
        return NextResponse.json(
          { error: "missing_api_key", message: e.message },
          { status: 503 },
        );
      }
      const message = e instanceof Error ? e.message : "unknown_error";
      return NextResponse.json({ error: "analyze_failed", message }, { status: 500 });
    }

    const creditQuestions = await consumeCreditsForAi("ai_questions", 10);
    if (!creditQuestions.ok) {
      return NextResponse.json(
        { error: creditQuestions.message, analysis: analysisData },
        { status: creditQuestions.status },
      );
    }

    try {
      const questions = await runInterviewQuestionGeneration({
        resume,
        jd,
        locale,
        rounds,
        extraHint: extraHint || undefined,
        analysis: analysisData,
        existingQuestionTitles: existingTitles,
      });
      if (questions.length === 0) {
        return NextResponse.json(
          { error: "empty_questions", analysis: analysisData },
          { status: 422 },
        );
      }
      return NextResponse.json({ ok: true, data: analysisData, questions });
    } catch (e) {
      if (e instanceof GeminiConfigError) {
        return NextResponse.json(
          { error: "missing_api_key", message: e.message, analysis: analysisData },
          { status: 503 },
        );
      }
      const message = e instanceof Error ? e.message : "unknown_error";
      return NextResponse.json(
        { error: "questions_failed", message, analysis: analysisData },
        { status: 500 },
      );
    }
  } catch (e) {
    if (e instanceof GeminiConfigError) {
      return NextResponse.json(
        { error: "missing_api_key", message: e.message },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "prep_pipeline_failed" }, { status: 500 });
  }
}
