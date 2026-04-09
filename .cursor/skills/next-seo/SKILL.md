---
name: next-seo
description: >-
  Applies technical and on-page SEO for Next.js App Router (metadata API,
  metadataBase, canonical/hreflang, sitemap.xml, robots.txt, Open Graph,
  JSON-LD). Use when the user asks for SEO, search visibility, Google indexing,
  SERP snippets, or “搜不到网站”.
---

# Next.js App Router · SEO

## 目标

让页面可被爬虫理解（标题、描述、规范 URL、多语言、站点地图），并配合 **Google Search Console** 完成收录。技术 SEO 不能替代：域名权重、外链、原创内容、以及时间（新站常需数日至数周）。

## 必做清单（本项目约定）

1. **生产环境站点根 URL**  
   设置 `NEXT_PUBLIC_SITE_URL`（如 `https://你的域名.com`，无末尾斜杠）。未设时用 Vercel 的 `VERCEL_URL`；本地为 `http://localhost:3000`。

2. **metadataBase**  
   在带 `<html>` 的布局里设置 `metadataBase: new URL(getSiteUrl())`，子页面 `alternates.canonical` 可用相对路径。

3. **公开页**  
   对首页、隐私、支持等使用 `generateMetadata`：独立 `title` / `description`、`alternates`（`canonical` + `languages` 含 `x-default`）、`openGraph`、`twitter`。

4. **sitemap.xml**  
   `app/sitemap.ts` 仅列出应被收录的路径；随语言前缀展开（如 `/en`、`/zh/...`）。

5. **robots.txt**  
   `app/robots.ts`：`Allow` 根路径，`Disallow` `/api/`、应用内页（如 `/*/workspace`）；`Sitemap` 指向绝对地址的 sitemap。

6. **结构化数据**  
   营销首页可注入 `WebSite` + `Organization` 的 JSON-LD（`application/ld+json`），`url` 与当前语言页一致。

7. **Search Console**  
   验证域名或 URL 前缀 → **站点地图** 提交 `https://域名/sitemap.xml` → 用 **网址检查** 看抓取与索引状态。

8. **可选验证**  
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → 填入 `metadata.verification.google`。

## 反模式

- 依赖 `<meta name="keywords">` 提升排名（Google 基本忽略）。
- 全站同一 `title`/`description`。
- 无 `hreflang` 的重复语言 URL。
- 把需登录的 App 页放进 sitemap 或允许随意抓取（浪费配额、易出无效摘要）。

## 相关代码路径（稿定面试 / InterviewScript）

- `web/src/lib/site-url.ts` — `getSiteUrl()`
- `web/src/lib/seo-metadata.ts` — `publicPageMetadata`、hreflang
- `web/src/app/sitemap.ts`、`web/src/app/robots.ts`
- `web/src/app/[locale]/layout.tsx` — 全局 metadata 与 `metadataBase`
- 公开路由：`[locale]/page.tsx`、`privacy`、`support` 的 `generateMetadata`
