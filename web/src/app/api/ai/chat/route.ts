import { NextResponse } from "next/server";
import { clampRoundsCount } from "@/lib/project-rounds";
import { GeminiConfigError, getGeminiProseModel } from "@/lib/gemini";
import { consumeCreditsForAi } from "@/lib/server/ai-guard";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_JD_CHARS = 6000;
const MAX_RESUME_CHARS = 6000;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      questionTitle?: string;
      messages?: ChatMessage[];
      locale?: string;
      jd?: string;
      resume?: string;
      round?: number;
    };
    const questionTitle = (body.questionTitle ?? "").trim();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const locale = body.locale === "en" ? "en" : "zh";
    const jd = (body.jd ?? "").trim().slice(0, MAX_JD_CHARS);
    const resume = (body.resume ?? "").trim().slice(0, MAX_RESUME_CHARS);
    const round = clampRoundsCount(Number(body.round) || 1);

    if (!questionTitle) {
      return NextResponse.json({ error: "question_required" }, { status: 400 });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser?.content?.trim()) {
      return NextResponse.json({ error: "user_message_required" }, { status: 400 });
    }

    const credit = await consumeCreditsForAi("ai_chat", 1);
    if (!credit.ok) {
      return NextResponse.json(
        { error: credit.message },
        { status: credit.status },
      );
    }

    const model = getGeminiProseModel();

    const langBlock =
      locale === "en"
        ? `Write the entire reply in clear English.
Use these Markdown section headings exactly (English labels):
## Answer outline
## Full script
## Pressure follow-ups`
        : `全文使用自然、口语化的中文。
请严格使用以下 Markdown 小节标题（照抄）：
## 答题大纲
## 逐字稿
## 追问与挑刺`;

    const roundTone =
      round <= 1
        ? "Interview round context: early / first round — prioritize ruthless resume & JD alignment challenges; assume a hostile or ultra-strict interviewer posture in *prep tone* (still ethical: pre-interview only)."
        : round === 2
          ? "Interview round context: second round — deeper technical or scenario pressure; fewer generic repeats vs round 1."
          : "Interview round context: later round — more on motivation, career rationale, education/values, long-term fit; still skeptical, not cheerleading.";

    const history = messages
      .slice(0, -1)
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`,
      )
      .join("\n");

    const materials =
      jd || resume
        ? `--- JOB DESCRIPTION (truncated) ---\n${jd || "(not provided)"}\n\n--- RESUME (truncated) ---\n${resume || "(not provided)"}\n`
        : "";

    const prompt = `You help candidates prepare BEFORE interviews only. Never assist cheating during a live interview.

PERSONA: Infer the employer's domain from the JD and question. Speak as a **senior hiring manager / domain expert** in that field (not a generic "interview coach"). Be direct and sparse with praise; prefer pressure, skepticism, and falsifiable checks on the candidate's claims.

STYLE: No small talk, no moral pep talk, no empty encouragement. Be concise.

OUTPUT STRUCTURE (in order):
1) Under "## Answer outline" / "## 答题大纲": 4–8 bullet lines. Each line = **memory keywords only** (short phrases the candidate can memorize). No paragraphs.
2) Under "## Full script" / "## 逐字稿": spoken answer as **short subsections** using \`### Subheading\` / \`### 小标题\` every 1–3 paragraphs so the candidate can chunk and memorize. Content must align with the outline.
3) Under "## Pressure follow-ups" / "## 追问与挑刺": 2–4 **skeptical, challenging** questions aimed at weak spots, hidden assumptions, or missing evidence in the user's message. Then add ONE short closing block that: asks what the user would add or change, what risks they foresee, or what counter-evidence an interviewer might use — collaborative but **adversarial / pressure-oriented**, not supportive fluff.

${langBlock}

${roundTone}

Current practice question: ${questionTitle}
Interview round number (1-based): ${round}

${materials}
${history ? `Prior chat:\n${history}\n` : ""}
User (latest message): ${lastUser.content.trim()}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return NextResponse.json({ ok: true, reply: text });
  } catch (e) {
    if (e instanceof GeminiConfigError) {
      return NextResponse.json(
        { error: "missing_api_key", message: e.message },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json({ error: "chat_failed", message }, { status: 500 });
  }
}
