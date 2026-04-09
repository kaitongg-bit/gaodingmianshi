import { getGeminiJsonModel } from "@/lib/gemini";

export const ANALYZE_SCHEMA_HINT = `Return ONLY valid JSON with this shape:
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

export type AnalyzeLocale = "en" | "zh";

export async function runResumeJdAnalysis(input: {
  resume: string;
  jd: string;
  locale: AnalyzeLocale;
}): Promise<unknown> {
  const model = getGeminiJsonModel();
  const lang =
    input.locale === "en"
      ? "Write all string values in natural English."
      : "所有字符串字段用自然中文书写。";

  const prompt = `You help candidates prepare BEFORE interviews (not cheating during interviews).
${lang}

${ANALYZE_SCHEMA_HINT}

--- RESUME ---
${input.resume}

--- JOB DESCRIPTION ---
${input.jd}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text) as unknown;
}
