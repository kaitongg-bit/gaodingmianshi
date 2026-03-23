import { NextResponse } from "next/server";
import { GeminiConfigError, getGeminiJsonModel } from "@/lib/gemini";
import { consumeCreditsForAi } from "@/lib/server/ai-guard";
import { buildQuestionRoundPlan, buildQuestionStyleBlock } from "./prompt-builders";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      resume?: string;
      jd?: string;
      locale?: string;
      rounds?: number;
      extraHint?: string;
      analysis?: unknown;
    };
    const resume = (body.resume ?? "").trim();
    const jd = (body.jd ?? "").trim();
    const locale = body.locale === "en" ? "en" : "zh";
    const rounds = Math.min(5, Math.max(1, Number(body.rounds) || 3));
    const extra = (body.extraHint ?? "").trim();
    const analysisStr =
      body.analysis !== undefined
        ? JSON.stringify(body.analysis, null, 2)
        : "";

    if (!resume || !jd) {
      return NextResponse.json(
        { error: "resume_and_jd_required" },
        { status: 400 },
      );
    }

    const credit = await consumeCreditsForAi("ai_questions", 1);
    if (!credit.ok) {
      return NextResponse.json(
        { error: credit.message },
        { status: credit.status },
      );
    }

    const model = getGeminiJsonModel();

    const lang =
      locale === "en"
        ? "Write each question title in natural English."
        : "每个问题的 title 用自然中文书写。";

    const prompt = `${buildQuestionRoundPlan(rounds)}

${buildQuestionStyleBlock(rounds)}

${lang}

--- RESUME ---
${resume}

--- JD ---
${jd}

${analysisStr ? `--- PRIOR ANALYSIS JSON ---\n${analysisStr}\n` : ""}
${extra ? `--- USER EXTRA HINT ---\n${extra}\n` : ""}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as {
      questions?: { round?: number; title?: string }[];
    };
    const raw = parsed.questions ?? [];
    const questions = raw
      .filter((q) => q.title?.trim())
      .slice(0, 20)
      .map((q, i) => ({
        id: `q-${i + 1}`,
        round: Math.min(rounds, Math.max(1, Number(q.round) || 1)),
        title: String(q.title).trim(),
      }));

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "empty_questions" },
        { status: 422 },
      );
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
