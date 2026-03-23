# gaodingmianshi

Next.js 应用在 **`web/`** 目录。

## Vercel 部署

任选其一（推荐 A）：

### A. 推荐：把 Root Directory 设为 `web`

1. Vercel 项目 → **Settings** → **General** → **Root Directory** → 填 **`web`**  
2. **Build & Development Settings**：**Framework Preset** 选 **Next.js**（或自动检测）  
3. **Output Directory** 留空（不要填 `public`）  
4. Install：`npm install`，Build：`npm run build`（使用 `web/package.json`）

### B. Root Directory 保持仓库根（`.`）

仓库根已提供 **`vercel.json`**（`framework: "nextjs"`）与 **`postbuild`**：在 Vercel 上构建结束后会把 `web/.next` 同步到根目录，供 Next 部署步骤识别。

请确认：

- **Output Directory** 未手动设为 `public`（留空即可）  
- **Framework Preset** 为 **Next.js**，不要选成纯静态站点  

环境变量仍在 Vercel 里按 `web/.env.example` 配置即可。
