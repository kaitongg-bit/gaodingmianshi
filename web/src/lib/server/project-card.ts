import type { AnalysisPayload } from "@/lib/client-session";

/** 与 DB 系统模板 `display_title` 一致；列表上替代 JD 首行里的「XYZ 云」占位公司名 */
export const DEMO_PROJECT_TITLE_ZH = "模拟练习 · 新手示例";
export const DEMO_PROJECT_TITLE_EN = "Practice demo · sample walkthrough";

/** 系统模板 fork 的默认列表标题（中文存库，英文在 API 层映射） */
export function resolveProjectListTitle(
  displayTitle: string | null | undefined,
  jdText: string,
  fallbackCompany: string,
  locale: string,
): string {
  const custom = (displayTitle ?? "").trim();
  if (custom) {
    if (locale === "en" && custom === DEMO_PROJECT_TITLE_ZH) {
      return DEMO_PROJECT_TITLE_EN;
    }
    return custom;
  }
  const jd = (jdText ?? "").trim();
  if (jd.startsWith("高级产品经理 | XYZ 云") || jd.includes("高级产品经理 | XYZ 云")) {
    return locale === "en" ? DEMO_PROJECT_TITLE_EN : DEMO_PROJECT_TITLE_ZH;
  }
  return fallbackCompany;
}

/** 演示 fork 项目：副标题用教程感文案，不用 JD 正文第二句 */
export function resolveDemoProjectRole(
  jdText: string,
  derivedRole: string,
  locale: string,
): string {
  const jd = (jdText ?? "").trim();
  if (!jd.startsWith("高级产品经理 | XYZ 云") && !jd.includes("高级产品经理 | XYZ 云")) {
    return derivedRole;
  }
  return locale === "en"
    ? "Sample résumé & JD — edit and explore"
    : "参考简历与 JD · 随便改着练";
}

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
