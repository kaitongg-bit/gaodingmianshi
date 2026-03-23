import { NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/server/require-auth";

export async function GET() {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, credits_balance, locale")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "profile_fetch_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? "",
      displayName: profile?.display_name ?? user.user_metadata?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    },
    creditsBalance: profile?.credits_balance ?? 0,
    locale: profile?.locale ?? null,
  });
}

export async function PATCH(req: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { avatar_url?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.avatar_url !== undefined) {
    if (body.avatar_url === null || body.avatar_url === "") {
      patch.avatar_url = null;
    } else if (typeof body.avatar_url === "string") {
      const u = body.avatar_url.trim();
      if (u.length > 2048) {
        return NextResponse.json({ error: "avatar_url_too_long" }, { status: 400 });
      }
      patch.avatar_url = u.length ? u : null;
    }
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
