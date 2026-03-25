/**
 * AI 常在 prepNotes 里夹带 Markdown（**粗体**、*斜体*、* 列表项），
 * 直接当纯文本展示会出现大量星号。此处做轻量清理，保留可读段落。
 */
export function formatPrepNoteForDisplay(raw: string): string {
  let t = raw.trim();
  if (!t) return "";

  for (let i = 0; i < 12; i++) {
    const next = t.replace(/\*\*([^*]+)\*\*/g, "$1");
    if (next === t) break;
    t = next;
  }

  t = t.replace(/\*([^*\n]+)\*/g, "$1");

  t = t.replace(/^[ \t]*\*[ \t]+/gm, "• ");
  t = t.replace(/^[ \t]*\-[ \t]+/gm, "• ");

  t = t.replace(/\*+/g, "");

  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}
