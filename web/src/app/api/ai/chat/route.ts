import { NextResponse } from "next/server";
import { clampRoundsCount } from "@/lib/project-rounds";
import {
  GeminiConfigError,
  getGeminiFactFallbackModelName,
  getGeminiFactModelName,
  getGeminiModelName,
  getGeminiProseModel,
} from "@/lib/gemini";
import { consumeCreditsForAi } from "@/lib/server/ai-guard";
import { notifyAiIssue } from "@/lib/server/notify-ai-issue";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatIntent = "interview_prep" | "factual_knowledge";

const MAX_JD_CHARS = 6000;
const MAX_RESUME_CHARS = 6000;

export const maxDuration = 120;

function shouldUseGoogleSearch(input: {
  questionTitle: string;
  latestUserMessage: string;
  locale: "zh" | "en";
}): { enabled: boolean; reasons: string[] } {
  const text = `${input.questionTitle}\n${input.latestUserMessage}`.trim();
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const freshnessRegex =
    /(latest|today|current|recent|recently|this year|this month|up[- ]?to[- ]?date|breaking|news|现在|目前|最新|最近|近期|今天|本周|本月|今年|刚刚)/i;
  if (freshnessRegex.test(text)) {
    score += 3;
    reasons.push("freshness_signal");
  }

  const factualRegex =
    /(what is|who is|which company|official site|官网|文档|发布|发布日期|价格|市值|融资|政策|版本|更新|对比|区别|benchmark|changelog)/i;
  if (factualRegex.test(text)) {
    score += 2;
    reasons.push("factual_lookup_signal");
  }

  if (/\b20\d{2}\b/.test(text) || /\bv?\d+\.\d+(\.\d+)?\b/.test(lower)) {
    score += 1;
    reasons.push("version_or_year_signal");
  }

  if (/\b[A-Z][A-Za-z0-9.+-]{2,}\b/.test(text)) {
    score += 1;
    reasons.push("proper_noun_signal");
  }

  if (
    /([^\s]{2,}\.(com|io|ai|cn|org|dev))|https?:\/\//i.test(text) ||
    /(openai|anthropic|google|meta|microsoft|nvidia|tesla|字节|阿里|腾讯|华为)/i.test(text)
  ) {
    score += 1;
    reasons.push("brand_or_domain_signal");
  }

  const interviewPersonalRegex =
    /(自我介绍|职业规划|为什么离职|优缺点|团队冲突|压力面|怎么介绍自己|self introduction|strengths|weaknesses|why leave|career plan)/i;
  if (interviewPersonalRegex.test(text) && score < 2) {
    score -= 2;
    reasons.push("behavioral_interview_signal");
  }

  return { enabled: score >= 2, reasons };
}

function detectChatIntent(input: {
  questionTitle: string;
  latestUserMessage: string;
}): ChatIntent {
  const text = `${input.questionTitle}\n${input.latestUserMessage}`.toLowerCase();

  let factualScore = 0;
  let interviewScore = 0;

  const factualSignals =
    /(是什么|什么意思|定义|原理|概念|区别|对比|如何工作|how does|what is|explain|difference|definition|architecture|benchmark|模型|术语|名词|openclaw|agent|llm|ai)/i;
  if (factualSignals.test(text)) factualScore += 2;

  const interviewSignals =
    /(面试|面试官|简历|jd|岗位|回答|追问|自我介绍|行为面|压力面|mock interview|interview|resume|job description|behavioral)/i;
  if (interviewSignals.test(text)) interviewScore += 2;

  const directKnowledgeQuestion =
    /(了解多少|说说|介绍一下|你怎么看|为什么会火|why is .* popular)/i;
  if (directKnowledgeQuestion.test(text)) factualScore += 1;

  return factualScore > interviewScore ? "factual_knowledge" : "interview_prep";
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

function sseData(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

function buildExternalFactGuardrails(input: {
  locale: "zh" | "en";
  latestUserMessage: string;
  useSearch: boolean;
  intent: ChatIntent;
}): string {
  if (!input.useSearch && input.intent !== "factual_knowledge") return "";
  const hasNamedEntity =
    /\b[A-Z][A-Za-z0-9.+-]{2,}\b/.test(input.latestUserMessage) ||
    /(openclaw|open claw|claude|gpt|gemini|openai|anthropic|langgraph|autogen|crewai)/i.test(
      input.latestUserMessage,
    );

  if (input.locale === "en") {
    const base = hasNamedEntity
      ? `FACT GUARDRAILS (CRITICAL):
- Keep external terms exactly as user wrote them (do NOT rename or auto-correct product names).
- For uncertain entities, explicitly state uncertainty and list 1-2 plausible interpretations.
- Never map an unknown term to a famous product without evidence.`
      : `FACT GUARDRAILS (CRITICAL):
- For externally verifiable facts, avoid guessing and state uncertainty when evidence is weak.`;
    const factualModeBoost =
      input.intent === "factual_knowledge"
        ? `
- In factual mode, prioritize giving a direct, concrete definition when evidence is sufficient (avoid unnecessary hedging).`
        : "";
    return `${base}${factualModeBoost}`;
  }

  const base = hasNamedEntity
    ? `事实护栏（必须遵守）：
- 用户提到的外部名词必须保留原写法，不要擅自改名、纠错或“猜成另一个产品”。
- 若名词不确定，请明确写“不确定”，并给出 1-2 个可能解释。
- 没有证据时，不要把陌生名词强行映射成知名产品。`
    : `事实护栏（必须遵守）：
- 涉及可验证外部事实时，证据不足就明确不确定，禁止脑补。`;
  const factualModeBoost =
    input.intent === "factual_knowledge"
      ? `
- 在知识问答模式下，证据充分时请直接下定义，不要过度保守。`
      : "";
  return `${base}${factualModeBoost}`;
}

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

    const intent = detectChatIntent({
      questionTitle,
      latestUserMessage: lastUser.content.trim(),
    });
    let selectedModelName =
      intent === "factual_knowledge" ? getGeminiFactModelName() : getGeminiModelName();
    const fallbackModelName =
      intent === "factual_knowledge" ? getGeminiFactFallbackModelName() : undefined;
    let model = getGeminiProseModel(selectedModelName);
    const searchDecision = shouldUseGoogleSearch({
      questionTitle,
      latestUserMessage: lastUser.content.trim(),
      locale,
    });
    const useSearch = intent === "factual_knowledge" ? true : searchDecision.enabled;
    const factGuardrails = buildExternalFactGuardrails({
      locale,
      latestUserMessage: lastUser.content.trim(),
      useSearch,
      intent,
    });

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

    const basePrompt =
      intent === "interview_prep"
        ? `You help candidates prepare BEFORE interviews only. Never assist cheating during a live interview.

PERSONA: Infer the employer's domain from the JD and question. Speak as a **senior hiring manager / domain expert** in that field (not a generic "interview coach"). Be direct and sparse with praise; prefer pressure, skepticism, and falsifiable checks on the candidate's claims.

STYLE: No small talk, no moral pep talk, no empty encouragement. Be concise.

OUTPUT STRUCTURE (in order):
1) Under "## Answer outline" / "## 答题大纲": 4–8 bullet lines. Each line = **memory keywords only** (short phrases the candidate can memorize). No paragraphs.
2) Under "## Full script" / "## 逐字稿": spoken answer as **short subsections** using \`### Subheading\` / \`### 小标题\` every 1–3 paragraphs so the candidate can chunk and memorize. Content must align with the outline.
3) Under "## Pressure follow-ups" / "## 追问与挑刺": 2–4 **skeptical, challenging** questions aimed at weak spots, hidden assumptions, or missing evidence in the user's message. Then add ONE short closing block that: asks what the user would add or change, what risks they foresee, or what counter-evidence an interviewer might use — collaborative but **adversarial / pressure-oriented**, not supportive fluff.
`
        : `You are in factual knowledge mode for interview prep support.

GOAL:
- Answer factual/technical questions accurately and clearly.
- If the user asks term definitions or differences (e.g., LLM, Agent, workflow), give direct definitions first, then concise comparison.

OUTPUT STRUCTURE (in order):
1) Under "## 答题大纲" / "## Answer outline": 4-8 short memory keywords.
2) Under "## 逐字稿" / "## Full script": concise explanation with practical examples.
3) Under "## 追问与挑刺" / "## Pressure follow-ups": 2-4 hard questions to test whether the user truly understands the concepts.
`;

    const prompt = `${basePrompt}

${langBlock}

${roundTone}
${factGuardrails ? `\n${factGuardrails}\n` : ""}

Current practice question: ${questionTitle}
Interview round number (1-based): ${round}

${materials}
${history ? `Prior chat:\n${history}\n` : ""}
User (latest message): ${lastUser.content.trim()}
`;

    let streamResult;
    const searchRequest = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
    } as unknown as Parameters<typeof model.generateContentStream>[0];

    async function runWithSearchFallback(currentModel = model) {
      try {
        return await currentModel.generateContentStream(
          useSearch ? searchRequest : prompt,
        );
      } catch (streamSetupErr) {
        if (useSearch) {
          console.warn(
            "[api/ai/chat] web search setup failed, fallback to plain model:",
            streamSetupErr instanceof Error
              ? streamSetupErr.message
              : String(streamSetupErr),
          );
          void notifyAiIssue("/api/ai/chat", streamSetupErr, {
            phase: "search_setup",
            intent,
            model: selectedModelName,
          });
          return await currentModel.generateContentStream(prompt);
        }
        throw streamSetupErr;
      }
    }

    try {
      streamResult = await runWithSearchFallback(model);
    } catch (primaryErr) {
      const shouldFallbackModel =
        intent === "factual_knowledge" &&
        fallbackModelName &&
        fallbackModelName !== selectedModelName;

      if (!shouldFallbackModel) throw primaryErr;

      void notifyAiIssue("/api/ai/chat", primaryErr, {
        phase: "model_primary_failed",
        intent,
        model: selectedModelName,
        fallbackModel: fallbackModelName,
      });

      selectedModelName = fallbackModelName;
      model = getGeminiProseModel(selectedModelName);
      streamResult = await runWithSearchFallback(model);
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResult.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(sseData({ text })));
            }
          }
          controller.enqueue(encoder.encode(sseData({ done: true })));
        } catch (streamErr) {
          const msg =
            streamErr instanceof Error ? streamErr.message : String(streamErr);
          console.error("[api/ai/chat] stream error:", msg);
          void notifyAiIssue("/api/ai/chat", streamErr, {
            phase: "stream",
            intent,
            model: selectedModelName,
          });
          controller.enqueue(
            encoder.encode(sseData({ error: "stream_error", message: msg })),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, { headers: sseHeaders() });
  } catch (e) {
    if (e instanceof GeminiConfigError) {
      void notifyAiIssue("/api/ai/chat", e, { phase: "config" });
      return NextResponse.json(
        { error: "missing_api_key", message: e.message },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "unknown_error";
    console.error("[api/ai/chat]", message, e);
    void notifyAiIssue("/api/ai/chat", e);
    return NextResponse.json({ error: "chat_failed", message }, { status: 500 });
  }
}
