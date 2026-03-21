import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

export function requireGeminiApiKey(): string {
  const key = getGeminiApiKey();
  if (!key) {
    throw new GeminiConfigError("GEMINI_API_KEY is not set");
  }
  return key;
}

export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
}

/** JSON responses (analyze, structured outputs). */
export function getGeminiJsonModel() {
  const genAI = new GoogleGenerativeAI(requireGeminiApiKey());
  return genAI.getGenerativeModel({
    model: getGeminiModelName(),
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
}

/** Plain text / chat. */
export function getGeminiProseModel() {
  const genAI = new GoogleGenerativeAI(requireGeminiApiKey());
  return genAI.getGenerativeModel({
    model: getGeminiModelName(),
  });
}
