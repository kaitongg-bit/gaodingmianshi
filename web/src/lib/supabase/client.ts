import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/** Client Component：与官方文档 createBrowserClient 一致 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
  return browserClient;
}

/** @deprecated 使用 createSupabaseBrowserClient */
export function getSupabaseBrowserClient(): SupabaseClient {
  return createSupabaseBrowserClient();
}
