/**
 * 与官方浏览器客户端用法对齐：`createClient()` 无参单例。
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function createClient() {
  return createSupabaseBrowserClient();
}
