/**
 * 题目主题分类（与 DB questions.topic_category、AI 输出 slug 一致）
 */
export const QUESTION_TOPIC_SLUGS = [
  "resume_deep",
  "career_motivation",
  "technical",
  "domain_general",
  "behavioral_soft",
  "other",
] as const;

export type QuestionTopicSlug = (typeof QUESTION_TOPIC_SLUGS)[number];

export function normalizeQuestionTopic(raw: string | null | undefined): QuestionTopicSlug {
  if (!raw || typeof raw !== "string") return "other";
  const s = raw.trim().toLowerCase().replace(/-/g, "_");
  return (QUESTION_TOPIC_SLUGS as readonly string[]).includes(s) ? (s as QuestionTopicSlug) : "other";
}

/** 导出按分类排序时的顺序 */
export const QUESTION_TOPIC_ORDER: QuestionTopicSlug[] = [...QUESTION_TOPIC_SLUGS];
