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

/**
 * Optional model override for factual knowledge questions.
 * Falls back to GEMINI_MODEL when not configured.
 */
export function getGeminiFactModelName(): string {
  return process.env.GEMINI_FACT_MODEL?.trim() || getGeminiModelName();
}

/**
 * Fallback model for factual knowledge questions.
 * Defaults to gemini-2.5-pro for better reliability if a preview model is unavailable.
 */
export function getGeminiFactFallbackModelName(): string {
  return process.env.GEMINI_FACT_FALLBACK_MODEL?.trim() || "gemini-2.5-pro";
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
export function getGeminiProseModel(modelName?: string) {
  const genAI = new GoogleGenerativeAI(requireGeminiApiKey());
  return genAI.getGenerativeModel({
    model: modelName || getGeminiModelName(),
  });
}
