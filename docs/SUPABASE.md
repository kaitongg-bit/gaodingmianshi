# 如何连接 Supabase（本项目）

## 两种「连接」，不要混用

### 1. Next.js 应用里用的连接（你现在要做的）

在 **Supabase Dashboard → Project Settings → API** 里复制：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL，形如 `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 给浏览器/服务端用的 **公钥**（新控制台常为 publishable，旧控制台为 `eyJ...` 的 anon JWT） |

把这两项写进 **`web/.env.local`**（已在 `.gitignore` 中，勿提交仓库）。

应用通过 **HTTPS REST + Auth**，由 `@supabase/ssr` / `createBrowserClient` / `createServerClient` 访问，**不是** Postgres 协议。

**代码入口：**

- 服务端（Server Component / Route Handler）：`import { createSupabaseServerClient } from "@/lib/supabase/server"`  
  若习惯官方路径：`import { createClient } from "@/utils/supabase/server"`，再 `const supabase = await createClient()`（注意 `cookies()` 需在 async 上下文中）。
- 浏览器（Client Component）：`import { createSupabaseBrowserClient } from "@/lib/supabase/client"` 或 `import { createClient } from "@/utils/supabase/client"`。

根目录 **`middleware.ts`** 已把 **Supabase 会话刷新** 与 **next-intl** 串在一起：在返回的 `response` 上写入 auth cookie，避免登录态丢失。

### 2. `postgresql://postgres:密码@db.xxx.supabase.co:5432/postgres`

这是 **PostgreSQL 直连**（psql、DBeaver、本地 migration CLI、部分 ORM）。

- 用于：**在 SQL Editor 里执行迁移**、本地备份、运维。
- **不要**把该连接串（尤其密码）写进 Next 的 `NEXT_PUBLIC_*` 或提交到 Git。
- 密码在 **Dashboard → Database → Database password** 查看或重置。

执行仓库内 SQL 迁移示例：打开 **Supabase → SQL Editor**，粘贴 `web/supabase/migrations/` 下文件内容执行。

## 自检是否连上

1. `.env.local` 已配置 URL + publishable/anon key，`cd web && npm run dev`。
2. 在任意 **Client Component** 里临时调用：  
   `createSupabaseBrowserClient().auth.getSession()` 看是否有 error。
3. 在 **Route Handler** 里：`const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();`

若报 `Missing NEXT_PUBLIC_...`，说明环境变量未加载或变量名不一致。

## 服务端特权（可选）

需要绕过 RLS 的管理脚本或 Webhook 可使用 **service_role** key，**仅**放在服务端环境变量（如 `SUPABASE_SERVICE_ROLE_KEY`），**永远不要**使用 `NEXT_PUBLIC_` 前缀。
