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
  const renameInputRef = useRef<HTMLInputElement>(null);
  const skipRenameBlurRef = useRef(false);

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

  const startRename = useCallback((e: React.MouseEvent, p: ProjectCard) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(p.id);
    setRenameDraft(p.title);
  }, []);

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

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          {list.map((p) => (
            <div
              key={p.id}
              className="group relative flex min-h-[260px] rounded-xl border border-[var(--outline-variant)]/10 bg-[var(--surface-container-lowest)] p-1 shadow-sm transition hover:shadow-[var(--shadow-card)]"
            >
              <Link
                href={`/workspace?project=${p.id}`}
                className="absolute inset-0 z-0 rounded-xl outline-none ring-inset ring-[var(--primary)] focus-visible:ring-2"
                aria-label={`${t("openProjectAria")}: ${p.title}`}
              />
              <div className="pointer-events-none relative z-[1] flex min-h-[252px] w-full flex-col rounded-lg bg-[var(--surface-container-low)] p-5 sm:flex-row sm:gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--outline-variant)]/10 bg-white shadow-sm sm:h-16 sm:w-16">
                  <MaterialIcon name="corporate_fare" className="!text-3xl text-[var(--primary)]" />
                </div>

                <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col sm:mt-0">
                  <div className="min-h-[3.5rem]">
                    {editingId === p.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        className="pointer-events-auto mb-1 w-full rounded-lg border border-[var(--outline-variant)]/40 bg-[var(--surface-container-lowest)] px-3 py-2 text-base font-semibold text-[var(--on-surface)] outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
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
                      <h3 className="line-clamp-2 font-headline text-lg font-bold leading-snug text-[var(--on-surface)] md:text-xl">
                        {p.title}
                      </h3>
                    )}
                  </div>

                  <div className="mt-2 flex items-start gap-1">
                    {editingId !== p.id ? (
                      <button
                        type="button"
                        title={t("renameTitle")}
                        aria-label={t("renameTitle")}
                        onClick={(e) => startRename(e, p)}
                        className="pointer-events-auto rounded-md p-1.5 text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
                      >
                        <MaterialIcon name="edit" className="!text-lg" />
                      </button>
                    ) : null}
                  </div>

                  <span className="mt-1 inline-flex w-fit rounded bg-[var(--surface-container-highest)] px-2 py-1 text-xs text-[var(--on-surface)]">
                    {p.role}
                  </span>

                  <p className="mt-3 text-sm text-[var(--on-surface-variant)]">{p.date}</p>

                  <div className="mt-3 flex items-center gap-4">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
                      <div
                        className="h-full bg-[var(--primary)] transition-[width]"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-[var(--primary)]">{p.progress}%</span>
                  </div>

                  <div className="relative z-[2] mt-auto flex justify-end pt-4">
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

        {realCount > 0 && (
          <div className="mt-14 flex justify-center">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)]/30 px-8 py-3 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--surface-container-low)]"
            >
              {t("loadArchive")}
              <MaterialIcon name="expand_more" className="!text-base" />
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 z-50 flex w-full justify-around border-t border-[var(--outline-variant)]/10 bg-[var(--surface)]/90 px-4 py-3 backdrop-blur-xl md:hidden">
        <span className="flex flex-col items-center text-[var(--primary)]">
          <MaterialIcon name="assignment" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">{t("mobileProjects")}</span>
        </span>
        <button type="button" onClick={() => void goNewSession()} className="flex flex-col items-center text-[var(--on-surface-variant)]">
          <MaterialIcon name="add_circle" />
          <span className="mt-1 text-[10px] font-medium uppercase tracking-widest">{t("mobileNew")}</span>
        </button>
        <span className="flex flex-col items-center text-[var(--on-surface-variant)]">
          <MaterialIcon name="settings" />
          <span className="mt-1 text-[10px] font-medium uppercase tracking-widest">{t("mobileSettings")}</span>
        </span>
      </nav>
    </div>
  );
}
