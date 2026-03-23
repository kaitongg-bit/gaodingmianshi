"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MaterialIcon } from "@/components/MaterialIcon";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { BillingPreviewModal } from "@/components/BillingPreviewModal";

function userInitial(
  displayName: string | null | undefined,
  email: string,
): string {
  const n = displayName?.trim();
  if (n) {
    const first = [...n][0];
    return first ? first.toUpperCase() : "?";
  }
  const e = email.trim();
  if (!e) return "?";
  return e[0].toUpperCase();
}

type Me = {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  creditsBalance: number;
};

export function NavAccountTray({
  sessionEmail,
  sessionDisplayName,
}: {
  sessionEmail: string;
  sessionDisplayName?: string | null;
}) {
  const t = useTranslations("UserMenu");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [uploading, setUploading] = useState(false);

  const refreshMe = useCallback(async () => {
    const r = await fetch("/api/me");
    if (!r.ok) {
      setMe(null);
      return;
    }
    const j = (await r.json()) as Me;
    setMe(j);
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [pathname, refreshMe]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshMe();
    });
    return () => subscription.unsubscribe();
  }, [refreshMe]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      const node = e.target as Node;
      if (menuRef.current?.contains(node) || buttonRef.current?.contains(node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const email = me?.user.email ?? sessionEmail;
  const displayName = me?.user.displayName ?? sessionDisplayName ?? null;
  const avatarUrl = me?.user.avatarUrl ?? null;
  const credits = me?.creditsBalance ?? 0;
  const initial = userInitial(displayName, email);

  async function onSignOut() {
    await createSupabaseBrowserClient().auth.signOut();
    setMenuOpen(false);
    setMe(null);
    router.replace("/", { locale });
  }

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!okTypes.includes(file.type)) return;
    if (file.size > 2 * 1024 * 1024) return;

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    setUploading(true);
    try {
      const path = `${session.user.id}/avatar`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type,
      });
      if (upErr) {
        console.error(upErr);
        return;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const patch = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: pub.publicUrl }),
      });
      if (!patch.ok) return;
      await refreshMe();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative flex items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onAvatarFile(e)}
      />
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--outline-variant)]/30 bg-[var(--surface-container-highest)] text-sm font-medium text-[var(--on-surface)] transition hover:border-[var(--primary)]/40"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title={displayName || email}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 用户上传的 Supabase 公网 URL，避免配置 remotePatterns
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {menuOpen ? (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--outline-variant)]/20 bg-[var(--surface)] p-3 shadow-lg"
        >
          <div className="flex gap-3 border-b border-[var(--outline-variant)]/15 pb-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--outline-variant)]/25 bg-[var(--surface-container-highest)] text-base font-medium text-[var(--on-surface)]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--on-surface)]">
                {displayName || email.split("@")[0] || "—"}
              </p>
              <p className="truncate text-xs text-[var(--on-surface-variant)]">{email}</p>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
              >
                {uploading ? "…" : t("changeAvatar")}
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-[var(--surface-container-low)] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
                  {t("balance")}
                </p>
                <p className="mt-0.5 font-headline text-base font-semibold text-[var(--on-surface)]">
                  {t("creditsCount", { n: credits })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBillingOpen(true);
                  setMenuOpen(false);
                }}
                className="shrink-0 text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                {t("topUp")}
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-0.5 py-1">
            <div className="flex items-center rounded-lg px-2 py-1.5 hover:bg-[var(--surface-container-low)]">
              <LocaleSwitcher />
            </div>
            <Link
              href="/support"
              locale={locale}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
            >
              <MaterialIcon name="help" className="!text-xl text-[var(--on-surface-variant)]" />
              {t("contactSupport")}
            </Link>
            <Link
              href="/privacy"
              locale={locale}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
            >
              <MaterialIcon name="shield" className="!text-xl text-[var(--on-surface-variant)]" />
              {t("privacyPolicy")}
            </Link>
          </div>

          <div className="mt-1 border-t border-[var(--outline-variant)]/15 pt-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => void onSignOut()}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-[#8B4513] hover:bg-[var(--surface-container-low)]"
            >
              <MaterialIcon name="logout" className="!text-xl" />
              {t("signOut")}
            </button>
          </div>
        </div>
      ) : null}

      <BillingPreviewModal open={billingOpen} onClose={() => setBillingOpen(false)} />
    </div>
  );
}
