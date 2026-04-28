# 稿定面试（InterviewScript）

面向**面试前准备**的 Web 应用：上传简历与岗位描述（JD），由服务端 AI 做匹配分析、生成练习题，并支持按题目与 AI 对话、整理可编辑的逐字稿。产品强调**合规备考**语境（非考场实时作弊）。界面为双语（中文 / 英文），技术栈为 **Next.js 16（App Router）**，实际应用在仓库的 **`web/`** 目录；仓库根使用 **npm workspace** 统一管理。

更完整的需求与信息架构见根目录 [`PRD.md`](./PRD.md)；视觉与组件约定见 [`docs/DESIGN.md`](./docs/DESIGN.md)。Supabase 相关说明见 [`docs/SUPABASE.md`](./docs/SUPABASE.md)。

---

## 克隆后如何本地运行

**环境要求**：建议 **Node.js 20 LTS** 或更高；包管理器为 **npm**。

在仓库根目录执行：

```bash
git clone <仓库地址>
cd gaodingmianshi

npm install
```

配置环境变量（至少配置 AI 相关键，否则分析 / 出题 / 对话接口会返回 503）：

```bash
cp web/.env.example web/.env
# 编辑 web/.env，至少填写 GEMINI_API_KEY（见 https://aistudio.google.com/apikey ）
# 登录、反馈等能力若需使用，请按 web/.env.example 补充 Supabase 等变量
```

启动开发服务器（在**仓库根目录**即可，与部署习惯一致）：

```bash
npm run dev
```

浏览器访问（端口以终端输出为准，默认 3000）：

- 中文首页：`http://localhost:3000/zh`
- 工作台：`http://localhost:3000/zh/app`

修改 `.env` 或 `.env.local` 后需**重启** `npm run dev`。若从 `web/` 目录单独运行，也可 `cd web && npm install && npm run dev`，此时环境文件仍放在 **`web/`** 下。

**其他常用命令（均在仓库根目录）**：

| 命令 | 说明 |
|------|------|
| `npm run build` | 生产构建（workspace 内 `web`） |
| `npm run start` | 本地以生产模式启动（需先 `build`） |
| `npm run lint` | 运行 ESLint（`web`） |

健康检查（排查 Key 是否被加载）：浏览器打开 `http://localhost:3000/api/ai/health`（端口与 dev 一致）。

---

## Vercel 部署（简要）

- **推荐**：Vercel 项目 **Root Directory** 设为 **`web`**，Framework 选 **Next.js**，Install：`npm install`，Build：`npm run build`，Output Directory 留空。环境变量在控制台按 `web/.env.example` 配置。
- **备选**：Root 保持仓库根时，仓库已提供 `vercel.json` 与 `postbuild`，用于构建后同步输出；同样勿将 Output Directory 设为 `public`。

---

## 目录说明

| 路径 | 说明 |
|------|------|
| `web/` | Next.js 应用源码与 `package.json` |
| `docs/` | 设计规范、Supabase 等文档 |
| `scripts/` | 根目录构建辅助脚本（如 Vercel postbuild） |
