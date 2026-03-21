import { NextResponse } from "next/server";
import { GeminiConfigError, getGeminiProseModel } from "@/lib/gemini";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      questionTitle?: string;
      messages?: ChatMessage[];
      locale?: string;
    };
    const questionTitle = (body.questionTitle ?? "").trim();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const locale = body.locale === "en" ? "en" : "zh";

    if (!questionTitle) {
      return NextResponse.json({ error: "question_required" }, { status: 400 });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser?.content?.trim()) {
      return NextResponse.json({ error: "user_message_required" }, { status: 400 });
    }

    const model = getGeminiProseModel();

    const langRule =
      locale === "en"
        ? "Reply in clear, concise English."
        : "用简洁、口语化的中文回复，适合面试前自拟逐字稿。";

    const history = messages
      .slice(0, -1)
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`,
      )
      .join("\n");

    const prompt = `You are an interview preparation coach. Help the candidate think through their answer OUTSIDE the interview room only. Do not encourage cheating.
Interview question: ${questionTitle}
${history ? `Prior chat:\n${history}\n` : ""}
User: ${lastUser.content.trim()}

${langRule}`;

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
