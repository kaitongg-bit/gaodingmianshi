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
import { MAX_INTERVIEW_ROUNDS } from "@/lib/project-rounds";

type Variant = "marketing" | "app";

type NavUser = { email: string; name?: string };

export function DraftNav({
  variant,
  activeStep,
  roundsCount = 3,
  onRoundSelect,
  prepProjectId,
  onAddRound,
  addRoundBusy,
  onRemoveRound,
  removeRoundBusy,
}: {
  variant: Variant;
  /** prep | round index 1..n */
  activeStep?: "prep" | number;
  roundsCount?: number;
  /** 工作区：点击 Round 切换轮次（与顶部下划线选中态一致，避免重复做第二排 pill） */
  onRoundSelect?: (round: number) => void;
  /** 工作区返回准备页时带上 project，避免丢会话 */
  prepProjectId?: string;
  /** 加号：增加一轮；上限见 MAX_INTERVIEW_ROUNDS */
  onAddRound?: () => void | Promise<void>;
  addRoundBusy?: boolean;
  /** 关闭某一轮（至少保留一轮） */
  onRemoveRound?: (round: number) => void | Promise<void>;
  removeRoundBusy?: boolean;
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
    <nav className="glass-nav fixed inset-x-0 top-0 z-[100] flex w-full items-center justify-between border-b border-[var(--outline-variant)]/15 px-4 py-3 md:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-10">
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
              className="flex min-w-0 shrink-0 items-center gap-2 font-headline text-base font-semibold tracking-tight text-[var(--on-surface)] md:gap-2.5 md:text-xl"
            >
              <BrandMark />
              <span className="hidden truncate sm:inline">{brand}</span>
            </Link>
          </div>
        ) : (
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 md:gap-3"
            title={brand}
          >
            <BrandMark />
            <span className="truncate font-headline text-lg font-semibold tracking-tight text-[var(--on-surface)] md:text-xl">
              {brand}
            </span>
          </Link>
        )}

        {variant === "app" && activeStep !== undefined && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-5 md:gap-6">
            <Link
              href={prepProjectId ? `/prep?project=${prepProjectId}` : "/prep"}
              className={`shrink-0 pb-1 text-xs transition-colors sm:text-sm ${
                activeStep === "prep"
                  ? "border-b-2 border-[var(--primary)] font-semibold text-[var(--on-surface)]"
                  : "border-b-2 border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              }`}
            >
              {t("prep")}
            </Link>
            {Array.from({ length: roundsCount }, (_, i) => i + 1).map((r) => {
              const selected = activeStep === r;
              const className = `shrink-0 pb-1 text-xs transition-colors sm:text-sm ${
                selected
                  ? "border-b-2 border-[var(--primary)] font-semibold text-[var(--on-surface)]"
                  : onRoundSelect
                    ? "border-b-2 border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
                    : "text-[var(--on-surface-variant)]"
              }`;
              const tab =
                onRoundSelect ? (
                  <button
                    type="button"
                    onClick={() => onRoundSelect(r)}
                    className={className}
                  >
                    {t("round", { n: r })}
                  </button>
                ) : (
                  <span className={className}>{t("round", { n: r })}</span>
                );
              return (
                <div key={r} className="flex shrink-0 items-end gap-0.5">
                  {tab}
                  {onRemoveRound && roundsCount > 1 ? (
                    <button
                      type="button"
                      disabled={removeRoundBusy}
                      title={t("removeRoundTitle", { n: r })}
                      aria-label={t("removeRoundTab", { n: r })}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void onRemoveRound(r);
                      }}
                      className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--error)] disabled:opacity-40"
                    >
                      <MaterialIcon name="close" className="!text-base" />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {onAddRound && roundsCount < MAX_INTERVIEW_ROUNDS ? (
              <button
                type="button"
                disabled={addRoundBusy}
                onClick={() => void onAddRound()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--outline-variant)]/25 text-[var(--on-surface-variant)] transition hover:border-[var(--primary)]/35 hover:bg-[var(--surface-container-low)] hover:text-[var(--primary)] disabled:opacity-40 sm:h-8 sm:w-8"
                aria-label={t("addRoundTab")}
                title={t("addRoundTitle", { max: MAX_INTERVIEW_ROUNDS })}
              >
                <MaterialIcon name="add" className="!text-lg sm:!text-xl" />
              </button>
            ) : null}
          </div>
        )}

      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        {variant === "marketing" ? <LocaleSwitcher /> : null}
        {user ? (
          <NavAccountTray sessionEmail={user.email} sessionDisplayName={user.name} />
        ) : (
          <>
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
