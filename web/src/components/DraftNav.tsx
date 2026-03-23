"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { BrandMark } from "@/components/BrandMark";
import { brandName } from "@/lib/brand";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { MaterialIcon } from "@/components/MaterialIcon";
import { NavAccountTray } from "@/components/NavAccountTray";
import { useEffect, useState } from "react";

type Variant = "marketing" | "app";

type NavUser = { email: string; name?: string };

export function DraftNav({
  variant,
  activeStep,
  roundsCount = 3,
  onRoundSelect,
  prepProjectId,
  onNewSession,
  newSessionBusy,
}: {
  variant: Variant;
  /** prep | round index 1..n */
  activeStep?: "prep" | number;
  roundsCount?: number;
  /** 工作区：点击 Round 切换轮次（与顶部下划线选中态一致，避免重复做第二排 pill） */
  onRoundSelect?: (round: number) => void;
  /** 工作区返回准备页时带上 project，避免丢会话 */
  prepProjectId?: string;
  /** 加号：新建项目并进入准备页（类似新标签） */
  onNewSession?: () => void | Promise<void>;
  newSessionBusy?: boolean;
}) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const brand = brandName(locale);
  const pathname = usePathname();
  const [user, setUser] = useState<NavUser | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    function refresh() {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) {
          setUser(null);
          return;
        }
        const meta = session.user.user_metadata as { display_name?: string } | undefined;
        setUser({
          email: session.user.email ?? "",
          name: meta?.display_name,
        });
      });
    }

    refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.unsubscribe();
  }, [pathname]);

  return (
    <nav className="glass-nav fixed top-0 z-50 flex w-full items-center justify-between border-b border-[var(--outline-variant)]/15 px-4 py-3 md:px-8">
      <div className="flex min-w-0 items-center gap-4 md:gap-10">
        {variant === "app" ? (
          <div className="flex min-w-0 items-center gap-1 md:gap-2">
            <Link
              href="/projects"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-low)] hover:text-[var(--primary)]"
              aria-label={t("backToProjects")}
            >
              <MaterialIcon name="arrow_back" className="!text-xl" />
            </Link>
            <Link
              href="/projects"
              className="flex min-w-0 items-center gap-2 truncate font-headline text-lg font-semibold tracking-tight text-[var(--on-surface)] md:gap-2.5 md:text-xl"
            >
              <BrandMark />
              <span className="truncate">{brand}</span>
            </Link>
          </div>
        ) : (
          <Link
            href={user ? "/projects" : "/"}
            className="flex min-w-0 items-center gap-2 md:gap-3"
          >
            <BrandMark />
            <span className="truncate font-headline text-lg font-semibold tracking-tight text-[var(--on-surface)] md:text-xl">
              {brand}
            </span>
          </Link>
        )}

        {variant === "app" && activeStep !== undefined && (
          <div className="hidden items-center gap-6 md:flex">
            <Link
              href={prepProjectId ? `/prep?project=${prepProjectId}` : "/prep"}
              className={`pb-1 text-sm transition-colors ${
                activeStep === "prep"
                  ? "border-b-2 border-[var(--primary)] font-semibold text-[var(--on-surface)]"
                  : "border-b-2 border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              }`}
            >
              {t("prep")}
            </Link>
            {Array.from({ length: roundsCount }, (_, i) => i + 1).map((r) => {
              const selected = activeStep === r;
              const className = `pb-1 text-sm transition-colors ${
                selected
                  ? "border-b-2 border-[var(--primary)] font-semibold text-[var(--on-surface)]"
                  : onRoundSelect
                    ? "border-b-2 border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                    : "text-[var(--on-surface-variant)]"
              }`;
              if (onRoundSelect) {
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onRoundSelect(r)}
                    className={className}
                  >
                    {t("round", { n: r })}
                  </button>
                );
              }
              return (
                <span key={r} className={className}>
                  {t("round", { n: r })}
                </span>
              );
            })}
            {onNewSession ? (
              <button
                type="button"
                disabled={newSessionBusy}
                onClick={() => void onNewSession()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--outline-variant)]/25 text-[var(--on-surface-variant)] transition hover:border-[var(--primary)]/35 hover:bg-[var(--surface-container-low)] hover:text-[var(--primary)] disabled:opacity-40"
                aria-label={t("newSessionTab")}
                title={t("newSessionTab")}
              >
                <MaterialIcon name="add" className="!text-xl" />
              </button>
            ) : null}
          </div>
        )}

        {variant === "marketing" && (
          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/projects"
              className="font-headline text-base italic tracking-tight text-[var(--primary)]"
            >
              {t("myProjects")}
            </Link>
            <span className="text-sm text-[var(--on-surface-variant)]">{t("settings")}</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        {user ? (
          <>
            <button
              type="button"
              className="rounded-full p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
              aria-label={t("notifications")}
            >
              <MaterialIcon name="notifications" className="!text-xl" />
            </button>
            <NavAccountTray sessionEmail={user.email} sessionDisplayName={user.name} />
          </>
        ) : (
          <>
            <LocaleSwitcher />
            <Link
              href="/auth/login"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
            >
              {t("login")}
            </Link>
            <Link
              href="/auth/register"
              className="rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--on-primary)] hover:opacity-95"
            >
              {t("register")}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
