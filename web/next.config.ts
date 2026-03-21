import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import createNextIntlPlugin from "next-intl/plugin";

/** 配置文件所在目录 = `web/`，与 `cwd` 无关，保证一定能读到 `web/.env` */
const webRoot = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(webRoot);

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
