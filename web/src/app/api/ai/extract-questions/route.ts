import { NextResponse } from "next/server";
import { GeminiConfigError, getGeminiJsonModel } from "@/lib/gemini";
import { normalizeQuestionTopic, QUESTION_TOPIC_SLUGS } from "@/lib/question-topics";
import { consumeCreditsForAi } from "@/lib/server/ai-guard";

const MAX_TEXT = 12_000;
const MAX_IMAGE_BASE64 = 6 * 1024 * 1024; // ~4.5MB binary upper bound for JSON body

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mimeType = m[1].trim();
  const data = m[2].replace(/\s/g, "");
  if (!mimeType.startsWith("image/")) return null;
  if (data.length > MAX_IMAGE_BASE64) return null;
  return { mimeType, data };
}

function parseModelJson(text: string): unknown {
  let raw = text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  }
  return JSON.parse(raw) as unknown;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      imageDataUrl?: string;
      text?: string;
      locale?: string;
    };

    const locale = body.locale === "en" ? "en" : "zh";
    const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
    const image =
      typeof body.imageDataUrl === "string" && body.imageDataUrl.length > 0
        ? parseDataUrl(body.imageDataUrl)
        : null;

    if (!image && !text) {
      return NextResponse.json({ error: "need_text_or_image" }, { status: 400 });
    }

    const credit = await consumeCreditsForAi("ai_extract_questions", 1);
    if (!credit.ok) {
      return NextResponse.json(
        { error: credit.message },
        { status: credit.status },
      );
    }

    const slugList = QUESTION_TOPIC_SLUGS.join(", ");
    const langLine =
      locale === "en"
        ? "Write each question title in natural English."
        : "每条题目的 title 使用自然、口语化的中文。";

    const prompt = `You extract interview practice questions from screenshots and/or pasted text.

TASK:
1) Read all visible question text (OCR from image if provided, plus any pasted text).
2) Split into SEPARATE items when there are multiple distinct questions (numbered lists, bullet lists, multiple paragraphs clearly asking different things, etc.). Merge accidental line breaks inside ONE question.
3) For EACH item assign exactly one category slug from: ${slugList}
   - resume_deep: resume / experience drilling, verifying CV claims, gaps
   - career_motivation: career plan, why this role/company, vision, motivation to move
   - technical: algorithms, system design, stack depth, debugging, hands-on technical
   - domain_general: business/industry knowledge weakly tied to the candidate's resume
   - behavioral_soft: personality, teamwork, hobbies, self-intro, values, soft skills
   - other: unclear or mixed

${langLine}

Return ONLY valid JSON (no markdown fence):
{"items":[{"title":"string","category":"resume_deep"}]}

If nothing looks like an interview question, return {"items":[]}.`;

    const model = getGeminiJsonModel();
    const textBlock = text
      ? `\n--- USER PASTED TEXT ---\n${text}\n--- END ---\n`
      : "";

    const result =
      image != null
        ? await model.generateContent([
            { text: prompt + textBlock },
            { inlineData: { mimeType: image.mimeType, data: image.data } },
          ])
        : await model.generateContent(prompt + textBlock);
    const outText = result.response.text();
    const parsed = parseModelJson(outText) as { items?: unknown };
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

    const items: { title: string; category: string }[] = [];
    for (const row of rawItems) {
      if (!row || typeof row !== "object") continue;
      const o = row as { title?: unknown; category?: unknown };
      const title = typeof o.title === "string" ? o.title.trim() : "";
      if (!title || title.length > 2000) continue;
      const category = normalizeQuestionTopic(
        typeof o.category === "string" ? o.category : undefined,
      );
      items.push({ title, category });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "no_questions_found" }, { status: 422 });
    }

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    if (e instanceof GeminiConfigError) {
      return NextResponse.json(
        { error: "missing_api_key", message: e.message },
        { status: 503 },
      );
    }
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: "model_json_invalid" }, { status: 502 });
    }
    const message = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json({ error: "extract_failed", message }, { status: 500 });
  }
}
