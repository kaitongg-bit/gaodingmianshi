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
      /** 已有题干，生成时需避免重复或仅改写的同义题 */
      existingQuestionTitles?: unknown;
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

    const existingTitles = Array.isArray(body.existingQuestionTitles)
      ? body.existingQuestionTitles
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 120)
      : [];

    const normalizeTitle = (s: string) =>
      s
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[，。！？、；：""''（）\s]+$/g, "")
        .trim();

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

    const avoidBlock =
      existingTitles.length > 0
        ? [
            "The candidate ALREADY has these practice question titles in their project.",
            "You MUST NOT repeat them, nor produce near-duplicates (same intent with minor wording changes).",
            "Each of the 20 new titles must cover a clearly different angle, scenario, or probe.",
            "Existing titles:",
            ...existingTitles.map((t, i) => `${i + 1}. ${t}`),
            "",
          ].join("\n")
        : "";

    const prompt = `${buildQuestionRoundPlan(rounds)}

${buildQuestionStyleBlock(rounds)}

${lang}

${avoidBlock ? `${avoidBlock}\n` : ""}--- RESUME ---
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
    const existingNorm = new Set(existingTitles.map((t) => normalizeTitle(t)));
    const seenNew = new Set<string>();
    const questions: { id: string; round: number; title: string }[] = [];

    for (const q of raw) {
      const title = String(q.title ?? "").trim();
      if (!title) continue;
      const norm = normalizeTitle(title);
      if (!norm) continue;
      if (existingNorm.has(norm) || seenNew.has(norm)) continue;
      seenNew.add(norm);
      questions.push({
        id: `q-${questions.length + 1}`,
        round: Math.min(rounds, Math.max(1, Number(q.round) || 1)),
        title,
      });
      if (questions.length >= 20) break;
    }

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
