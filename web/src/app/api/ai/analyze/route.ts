import { NextResponse } from "next/server";
import { GeminiConfigError } from "@/lib/gemini";
import { consumeCreditsForAi } from "@/lib/server/ai-guard";
import { runResumeJdAnalysis } from "@/lib/server/ai-analyze-core";
import { notifyAiIssue } from "@/lib/server/notify-ai-issue";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      resume?: string;
      jd?: string;
      locale?: string;
    };
    const resume = (body.resume ?? "").trim();
    const jd = (body.jd ?? "").trim();
    const locale = body.locale === "en" ? "en" : "zh";

    if (!resume || !jd) {
      return NextResponse.json(
        { error: "resume_and_jd_required" },
        { status: 400 },
      );
    }

    const credit = await consumeCreditsForAi("ai_analyze", 1);
    if (!credit.ok) {
      return NextResponse.json(
        { error: credit.message },
        { status: credit.status },
      );
    }

    const parsed = await runResumeJdAnalysis({ resume, jd, locale });
    return NextResponse.json({ ok: true, data: parsed });
  } catch (e) {
    if (e instanceof GeminiConfigError) {
      void notifyAiIssue("/api/ai/analyze", e, { phase: "config" });
      return NextResponse.json(
        { error: "missing_api_key", message: e.message },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "unknown_error";
    void notifyAiIssue("/api/ai/analyze", e);
    return NextResponse.json({ error: "analyze_failed", message }, { status: 500 });
  }
}
