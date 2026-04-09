import { clampRoundsCount } from "@/lib/project-rounds";
import { getGeminiJsonModel } from "@/lib/gemini";
import { buildQuestionRoundPlan, buildQuestionStyleBlock } from "@/app/api/ai/questions/prompt-builders";

export type GeneratedQuestionItem = { id: string; round: number; title: string };

const normalizeTitle = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[，。！？、；：""''（）\s]+$/g, "")
    .trim();

export async function runInterviewQuestionGeneration(input: {
  resume: string;
  jd: string;
  locale: "en" | "zh";
  rounds: number;
  extraHint?: string;
  analysis?: unknown;
  existingQuestionTitles?: string[];
}): Promise<GeneratedQuestionItem[]> {
  const rounds = clampRoundsCount(input.rounds || 3);
  const extra = (input.extraHint ?? "").trim();
  const analysisStr =
    input.analysis !== undefined ? JSON.stringify(input.analysis, null, 2) : "";

  const existingTitles = (input.existingQuestionTitles ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 120);

  const model = getGeminiJsonModel();

  const lang =
    input.locale === "en"
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
${input.resume}

--- JD ---
${input.jd}

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
  const questions: GeneratedQuestionItem[] = [];

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

  return questions;
}
