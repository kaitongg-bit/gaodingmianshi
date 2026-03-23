export type ScriptsPayload = { scripts?: Record<string, string> };

export function parseScriptsFromTranscript(raw: string): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const j = JSON.parse(raw) as ScriptsPayload;
    if (j && typeof j === "object" && j.scripts && typeof j.scripts === "object") {
      return j.scripts as Record<string, string>;
    }
  } catch {
    /* legacy plain text */
  }
  return {};
}

export function serializeScriptsToTranscript(scripts: Record<string, string>): string {
  return JSON.stringify({ scripts });
}
