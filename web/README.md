# InterviewScript · 稿定面试（MVP Web）

Next.js 16 + App Router + `next-intl`（`zh` / `en`）+ 服务端 **Google Gemini**。

## 本地运行

```bash
cd web
cp .env.example .env
# 或 .env.local；编辑文件填入 GEMINI_API_KEY（https://aistudio.google.com/apikey）
npm install
npm run dev
```

浏览器访问：

- 中文：`http://localhost:3000/zh`
- 工作台：`http://localhost:3000/zh/app`

未配置 `GEMINI_API_KEY` 时，分析 / 生成题目 / 对话接口会返回 503。`.env` 与 `.env.local` 均可；**改环境变量后需重启** `npm run dev`。

若在界面仍提示缺 Key：

1. **`npm run dev` 必须在 `web/` 目录下执行。**
2. **`.env` 里密钥必须与 `GEMINI_API_KEY=` 同一行**，等号后面不能空着、不能把 Key 换到下一行；改完后 **保存文件** 并重启 dev。
3. 浏览器打开 **`http://localhost:3000/api/ai/health`**（端口按你的 dev 为准），看 `geminiKeyLoaded`、`envFileValueLength` 和 `hint`。

`next.config.ts` 已在加载配置时从 `web/` 根目录执行 `loadEnvConfig`，与 `cwd` 无关。

## 环境变量

| 变量 | 说明 |
|------|------|
| `GEMINI_API_KEY` | 必填，Gemini API Key |
| `GEMINI_MODEL` | 可选，默认 `gemini-2.0-flash` |

## API（服务端）

- `POST /api/ai/analyze` — 简历 + JD → 匹配度与 JSON 前析
- `POST /api/ai/questions` — 生成 20 道练习题（按轮次分配）
- `POST /api/ai/chat` — 按题目与 AI 多轮对话（面试**前**准备语境）

部署到 **Vercel** 时，在控制台配置同名环境变量即可。
