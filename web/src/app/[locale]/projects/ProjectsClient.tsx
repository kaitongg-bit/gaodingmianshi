"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { DraftNav } from "@/components/DraftNav";
import { MaterialIcon } from "@/components/MaterialIcon";
import type { ProjectCard } from "@/lib/projects-storage";
import { useCallback, useEffect, useRef, useState } from "react";

export function ProjectsClient() {
  const t = useTranslations("Projects");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [list, setList] = useState<ProjectCard[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const skipRenameBlurRef = useRef(false);
  const cardMenuRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const r = await fetch(`/api/projects?locale=${encodeURIComponent(locale)}`);
    const j = (await r.json()) as { projects?: ProjectCard[]; error?: string };
    if (!r.ok) {
      setLoadError(j.error ?? "error");
      setList([]);
      return;
    }
    setList(j.projects ?? []);
  }, [locale]);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    if (editingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (!openMenuId) return;
    function onDoc(e: MouseEvent) {
      const node = e.target as Node;
      if (cardMenuRef.current?.contains(node)) return;
      setOpenMenuId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openMenuId]);

  const realCount = list.length;
  const avgProgress =
    realCount === 0
      ? null
      : Math.round(list.reduce((s, p) => s + p.progress, 0) / realCount);

  async function goNewSession() {
    const r = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = (await r.json()) as { id?: string; error?: string };
    if (!r.ok || !j.id) {
      setLoadError(j.error ?? "create_failed");
      return;
    }
    router.push(`/prep?project=${j.id}`);
  }

  const commitRename = useCallback(
    async (id: string) => {
      const next = renameDraft.trim();
      setEditingId(null);
      const r = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_title: next.length ? next : null }),
      });
      if (r.ok) void refresh();
    },
    [renameDraft, refresh],
  );

  const cancelRename = useCallback(() => {
    skipRenameBlurRef.current = true;
    setEditingId(null);
  }, []);

  const openRenameFromMenu = useCallback((p: ProjectCard) => {
    setOpenMenuId(null);
    setEditingId(p.id);
    setRenameDraft(p.title);
  }, []);

  const deleteProject = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      setOpenMenuId(null);
      if (!window.confirm(t("deleteConfirm"))) return;
      setDeletingId(id);
      setLoadError(null);
      try {
        const r = await fetch(`/api/projects/${id}`, { method: "DELETE" });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) {
          setLoadError(j.error === "unauthorized" ? t("deleteUnauthorized") : t("deleteFailed"));
          return;
        }
        if (editingId === id) setEditingId(null);
        await refresh();
      } finally {
        setDeletingId(null);
      }
    },
    [t, refresh, editingId],
  );

  return (
    <div className="min-h-full bg-[var(--background)] pb-24 md:pb-8">
      <DraftNav variant="marketing" />
      <main id="main" className="mx-auto max-w-7xl px-4 pb-8 pt-24 md:px-12">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-headline text-4xl font-medium tracking-tight text-[var(--on-surface)] md:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-[var(--on-surface-variant)]">{t("subtitle")}</p>
          </div>
          <Link
            href="/question-bank"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-2xl border border-[var(--outline-variant)]/25 bg-[var(--surface-container-low)] px-4 py-3 text-sm font-semibold text-[var(--primary)] shadow-sm transition hover:border-[var(--primary)]/30 hover:bg-[var(--surface-container-high)]/60 md:self-end"
          >
            <MaterialIcon name="hub" className="!text-xl" />
            <span className="text-left leading-tight">
              <span className="block">{t("questionBankEntry")}</span>
              <span className="mt-0.5 block text-[11px] font-normal text-[var(--on-surface-variant)]">
                {t("questionBankEntrySub")}
              </span>
            </span>
            <MaterialIcon name="chevron_right" className="!text-lg text-[var(--on-surface-variant)]" />
          </Link>
        </header>

        {loadError ? (
          <p className="mb-6 text-center text-sm text-amber-800">{loadError}</p>
        ) : null}

        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex min-h-[160px] flex-col justify-between rounded-xl border border-[var(--outline-variant)]/10 bg-[var(--surface-container-low)] p-6">
            <span className="text-xs font-medium uppercase tracking-widest text-[var(--on-surface-variant)]">
              {t("totalSessions")}
            </span>
            <div>
              <span className="font-headline text-4xl font-semibold">{realCount}</span>
              <p className="mt-1 flex items-center gap-1 text-sm text-[var(--primary)]">
                <MaterialIcon name="trending_up" className="!text-base" />
                {t("trend")}
              </p>
            </div>
          </div>
          <div className="relative flex min-h-[160px] flex-col justify-between overflow-hidden rounded-xl bg-[var(--primary-container)] p-6">
            <div className="relative z-10">
              <span className="text-xs font-medium uppercase tracking-widest text-[var(--on-primary-container)]">
                {t("avgScore")}
              </span>
              <div className="mt-4">
                <span className="font-headline text-4xl font-semibold text-[var(--on-surface)]">
                  {avgProgress != null ? `${avgProgress}%` : t("avgScoreEmpty")}
                </span>
                <p className="mt-1 text-sm text-[var(--on-primary-container)]/80">{t("avgScoreSub")}</p>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 h-32 w-32 rounded-full bg-[var(--primary)]/10 blur-2xl" />
          </div>
          <button
            type="button"
            onClick={() => void goNewSession()}
            className="group flex min-h-[160px] cursor-pointer items-center justify-center rounded-xl border border-transparent bg-[var(--surface-container-highest)] transition hover:border-[var(--primary)]/20"
          >
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] shadow-sm transition group-hover:scale-110">
                <MaterialIcon name="add" className="text-[var(--primary)]" />
              </div>
              <span className="text-sm font-medium text-[var(--on-surface)]">{t("newSession")}</span>
            </div>
          </button>
        </div>

        {realCount === 0 && (
          <p className="mb-8 text-center text-sm text-[var(--on-surface-variant)]">{t("emptyHint")}</p>
        )}

        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          {list.map((p) => (
            <div
              key={p.id}
              className="group relative rounded-xl border border-[var(--outline-variant)]/10 bg-[var(--surface-container-lowest)] p-px shadow-sm transition hover:shadow-[var(--shadow-card)]"
            >
              <Link
                href={
                  (p.questionCount ?? 0) === 0
                    ? `/prep?project=${p.id}`
                    : `/workspace?project=${p.id}`
                }
                className="absolute inset-0 z-0 rounded-[0.6875rem] outline-none ring-inset ring-[var(--primary)] focus-visible:ring-2"
                aria-label={`${t("openProjectAria")}: ${p.title}`}
              />
              <div className="pointer-events-none relative z-[1] flex w-full items-stretch gap-3 rounded-[0.625rem] bg-[var(--surface-container-low)] px-3 py-3 sm:gap-4 sm:px-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--outline-variant)]/10 bg-white shadow-sm sm:h-11 sm:w-11">
                  <MaterialIcon name="corporate_fare" className="!text-2xl text-[var(--primary)] sm:!text-[1.75rem]" />
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {editingId === p.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          className="pointer-events-auto w-full rounded-lg border border-[var(--outline-variant)]/40 bg-[var(--surface-container-lowest)] px-2.5 py-1.5 text-sm font-semibold text-[var(--on-surface)] outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void commitRename(p.id);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          onBlur={() => {
                            if (skipRenameBlurRef.current) {
                              skipRenameBlurRef.current = false;
                              return;
                            }
                            void commitRename(p.id);
                          }}
                        />
                      ) : (
                        <>
                          <h3 className="line-clamp-1 font-headline text-base font-bold leading-tight text-[var(--on-surface)] sm:text-lg">
                            {p.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-[var(--on-surface-variant)]">{p.date}</p>
                        </>
                      )}
                    </div>

                    {editingId !== p.id ? (
                      <div
                        ref={openMenuId === p.id ? cardMenuRef : undefined}
                        className="pointer-events-auto relative z-[3] shrink-0"
                      >
                        <button
                          type="button"
                          title={t("cardMenuAria")}
                          aria-label={t("cardMenuAria")}
                          aria-expanded={openMenuId === p.id}
                          aria-haspopup="menu"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId((id) => (id === p.id ? null : p.id));
                          }}
                          className="-mr-1 -mt-0.5 rounded-lg p-1.5 text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]"
                        >
                          <MaterialIcon name="more_vert" className="!text-xl" />
                        </button>
                        {openMenuId === p.id ? (
                          <div
                            role="menu"
                            className="absolute right-0 top-full z-[4] mt-1 min-w-[9.5rem] rounded-xl border border-[var(--outline-variant)]/15 bg-[var(--surface)] py-1 shadow-lg"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openRenameFromMenu(p);
                              }}
                            >
                              <MaterialIcon name="edit" className="!text-lg text-[var(--on-surface-variant)]" />
                              {t("renameTitle")}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              disabled={deletingId === p.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--error)] hover:bg-[var(--error)]/8 disabled:opacity-40"
                              onClick={(e) => void deleteProject(p.id, e)}
                            >
                              <MaterialIcon name="delete" className="!text-lg" />
                              {t("deleteTitle")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 flex items-center gap-3 sm:mt-2.5">
                    <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)] transition-[width]"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--primary)] sm:text-sm">
                      {p.progress}%
                    </span>
                  </div>

                  <div className="relative z-[2] mt-2 flex justify-end sm:mt-2.5">
                    <Link
                      href={`/prep?project=${p.id}`}
                      className="pointer-events-auto text-xs font-medium text-[var(--on-surface-variant)] underline-offset-4 transition hover:text-[var(--primary)] hover:underline"
                    >
                      {t("editPrep")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 z-50 flex w-full justify-around border-t border-[var(--outline-variant)]/10 bg-[var(--surface)]/90 px-2 py-3 backdrop-blur-xl md:hidden">
        <span className="flex min-w-0 flex-1 flex-col items-center text-[var(--primary)]">
          <MaterialIcon name="assignment" />
          <span className="mt-1 max-w-[4.5rem] truncate text-center text-[10px] font-bold uppercase tracking-widest">
            {t("mobileProjects")}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void goNewSession()}
          className="flex min-w-0 flex-1 flex-col items-center text-[var(--on-surface-variant)]"
        >
          <MaterialIcon name="add_circle" />
          <span className="mt-1 max-w-[4.5rem] truncate text-center text-[10px] font-medium uppercase tracking-widest">
            {t("mobileNew")}
          </span>
        </button>
        <Link href="/question-bank" className="flex min-w-0 flex-1 flex-col items-center text-[var(--on-surface-variant)]">
          <MaterialIcon name="hub" />
          <span className="mt-1 max-w-[4.5rem] truncate text-center text-[10px] font-medium uppercase tracking-widest">
            {t("mobileQuestionBank")}
          </span>
        </Link>
        <Link href="/support" className="flex min-w-0 flex-1 flex-col items-center text-[var(--on-surface-variant)]">
          <MaterialIcon name="help" />
          <span className="mt-1 max-w-[4.5rem] truncate text-center text-[10px] font-medium uppercase tracking-widest">
            {t("mobileSupport")}
          </span>
        </Link>
      </nav>
    </div>
  );
}
