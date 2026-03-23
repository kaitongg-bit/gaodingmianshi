/**
 * 从 AI 回复中去掉常见寒暄、重复标题与多余 Markdown 装饰，得到更适合逐字稿的正文。
 */
export function cleanScriptContent(raw: string, questionTitle: string): string {
  let s = raw.trim();
  if (!s) return "";

  const title = questionTitle.trim();
  if (title.length > 0) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`^#{1,6}\\s*${esc}\\s*`, "m"), "");
    s = s.replace(new RegExp(`^\\*\\*\\s*${esc}\\s*\\*\\*\\s*`, "m"), "");
  }

  s = s.replace(/^\*{1,2}([^*\n]+)\*{1,2}\s*$/gm, "$1");

  const lines = s.split(/\r?\n/);
  if (lines.length > 0) {
    let first = lines[0];
    first = first
      .replace(/^(好的|好的，|当然|没问题|可以的|明白|了解了|以下是|这里)[，,。.!！\s]*/u, "")
      .replace(/^(Sure|Certainly|Of course|Great|Here'?s?|Below is)[,.\s:]*/i, "")
      .trim();
    lines[0] = first;
    s = lines.join("\n").trim();
  }

  s = s.replace(
    /[\s]*(希望对你有帮助|希望以上对你|供你参考|以上供参考|祝面试顺利|如有需要可以再问|欢迎继续追问)[。.!！\s]*$/u,
    "",
  );
  s = s.replace(
    /[\s]*(Hope this helps|Let me know if you need|Feel free to ask)[.!\s]*$/i,
    "",
  );

  s = s.replace(/\*{2,}/g, "");
  /* 保留 ## / ### 等小标题，便于逐字稿分段记忆；不再整篇去掉所有 Markdown 标题 */
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  return s;
}
