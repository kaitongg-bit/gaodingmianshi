/**
 * 当以仓库根为 Vercel Root Directory 时，Next 实际在 web/ 下构建，产物在 web/.next。
 * Vercel 的 Next 部署步骤默认在「项目根」找 .next；仅在 VERCEL=1 时把产物同步到根目录。
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

if (!process.env.VERCEL) {
  process.exit(0);
}

const root = process.cwd();
const webDir = join(root, "web");
const webNext = join(webDir, ".next");
const webPublic = join(webDir, "public");

if (!existsSync(webNext)) {
  console.error("sync-next-output: web/.next missing after build");
  process.exit(1);
}

const rootNext = join(root, ".next");
const rootPublic = join(root, "public");

rmSync(rootNext, { recursive: true, force: true });
cpSync(webNext, rootNext, { recursive: true });

rmSync(rootPublic, { recursive: true, force: true });
if (existsSync(webPublic)) {
  mkdirSync(rootPublic, { recursive: true });
  cpSync(webPublic, rootPublic, { recursive: true });
}
