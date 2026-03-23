/** 未执行 `20250325130000_question_topic_category.sql` 时无 `topic_category` 列，Postgres 报错 42703 */

export const QUESTIONS_SELECT_MINIMAL =
  "id, round_index, title, source, sort_order, attachment_url" as const;

export function isPostgresUndefinedColumn(err: { code?: string } | null | undefined): boolean {
  return err?.code === "42703";
}
