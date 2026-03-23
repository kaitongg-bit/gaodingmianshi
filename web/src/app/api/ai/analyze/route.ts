import { NextResponse } from "next/server";
import { GeminiConfigError, getGeminiJsonModel } from "@/lib/gemini";
import { consumeCreditsForAi } from "@/lib/server/ai-guard";

const SCHEMA_HINT = `Return ONLY valid JSON with this shape:
{
  "overallFit": { "label": string, "score0to100": number, "oneLiner": string },
  "dimensions": [ { "name": string, "level": string, "detail": string } ],
  "prepNotes": {
    "strengths": string,
    "gaps": string,
    "likelyQuestionThemes": string
  }
}
Use 4–6 dimensions such as: hard skills coverage, experience relevance, transferable skills, gaps/risks, communication evidence, domain fit.`;

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

    const model = getGeminiJsonModel();

    const lang =
      locale === "en"
        ? "Write all string values in natural English."
        : "所有字符串字段用自然中文书写。";

    const prompt = `You help candidates prepare BEFORE interviews (not cheating during interviews).
${lang}

${SCHEMA_HINT}

--- RESUME ---
${resume}

--- JOB DESCRIPTION ---
${jd}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as unknown;
    return NextResponse.json({ ok: true, data: parsed });
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
}
