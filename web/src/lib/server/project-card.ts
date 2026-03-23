import type { AnalysisPayload } from "@/lib/client-session";

function firstLine(text: string, max = 56): string {
  const line = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!line) return "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

export function deriveCompanyRoleFromMaterials(
  jd: string,
  analysis: AnalysisPayload | null,
): { company: string; role: string } {
  const jdLine = firstLine(jd);
  const company = jdLine || "Interview target";
  const role =
    analysis?.overallFit?.label?.slice(0, 48) ||
    firstLine(jd.split(/\n/).slice(1).join("\n")) ||
    "Role";
  return { company, role };
}

export function formatProjectDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}
