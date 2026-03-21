import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

function peekEnvFileKeyLength(webRoot: string): { linePresent: boolean; valueLength: number } {
  const p = path.join(webRoot, ".env");
  if (!fs.existsSync(p)) return { linePresent: false, valueLength: 0 };
  const text = fs.readFileSync(p, "utf8");
  const m = text.match(/^GEMINI_API_KEY=(.*)$/m);
  if (!m) return { linePresent: false, valueLength: 0 };
  const raw = m[1].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
  return { linePresent: true, valueLength: raw.length };
}

/** 调试用：不返回密钥；若进程无 Key 会对比磁盘 .env 是否「写了空值」 */
export async function GET() {
  const key = process.env.GEMINI_API_KEY?.trim();
  const cwd = process.cwd();
  const disk = peekEnvFileKeyLength(cwd);

  let hint: string | undefined;
  if (!key && disk.linePresent && disk.valueLength === 0) {
    hint =
      "disk_env_empty: .env 里有 GEMINI_API_KEY= 但等号后没有内容。请把整段 Key 写在同一行并保存（Cmd+S），再重启 dev。";
  } else if (!key && !disk.linePresent) {
    hint = "no_gemini_line: 在 web/.env 中添加一行 GEMINI_API_KEY=你的密钥";
  }

  return NextResponse.json({
    geminiKeyLoaded: Boolean(key),
    keyLength: key ? key.length : 0,
    envFileLinePresent: disk.linePresent,
    envFileValueLength: disk.valueLength,
    model: process.env.GEMINI_MODEL?.trim() || "(default gemini-2.0-flash)",
    cwd,
    hint,
  });
}
