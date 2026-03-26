"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DraftNav } from "@/components/DraftNav";
import { MaterialIcon } from "@/components/MaterialIcon";
import { formatPrepNoteForDisplay } from "@/lib/format-prep-note";
import { trackEvent } from "@/lib/analytics";
import { QUESTION_TOPIC_ORDER, type QuestionTopicSlug } from "@/lib/question-topics";

type BankItem = {
  id: string;
  projectId: string;
  projectTitle: string;
  round: number;
  topicCategory: string;
  title: string;
  answered: boolean;
  assistantExcerpt: string;
  userTurnCount: number;
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function QuestionBankClient() {
  const t = useTranslations("QuestionBank");
  const tTopic = useTranslations("Workspace");
  const locale = useLocale();
  const [items, setItems] = useState<BankItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  /** 全部展示所有分类；选中某一类时只渲染该类，避免长页滚动 */
  const [topicFilter, setTopicFilter] = useState<"all" | QuestionTopicSlug>("all");
  const listAnchorRef = useRef<HTMLDivElement>(null);
  const skipFilterScrollRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/question-bank?locale=${encodeURIComponent(locale)}`);
      const j = (await r.json()) as { items?: BankItem[]; error?: string };
      if (!r.ok) {
        setItems([]);
        setLoadError(j.error ?? "error");
        return;
      }
      setItems(j.items ?? []);
    } catch {
      setLoadError("network");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byCategory = useMemo(() => {
    const m = new Map<string, BankItem[]>();
    for (const slug of QUESTION_TOPIC_ORDER) {
      m.set(slug, []);
    }
    for (const it of items) {
      const slug = (QUESTION_TOPIC_ORDER as readonly string[]).includes(it.topicCategory)
        ? it.topicCategory
        : "other";
      const arr = m.get(slug) ?? [];
      arr.push(it);
      m.set(slug, arr);
    }
    return m;
  }, [items]);

  const nonEmptySlugs = useMemo(
    () => QUESTION_TOPIC_ORDER.filter((s) => (byCategory.get(s)?.length ?? 0) > 0),
    [byCategory],
  );

  const visibleSlugs = useMemo(() => {
    if (topicFilter === "all") return nonEmptySlugs;
    return (byCategory.get(topicFilter)?.length ?? 0) > 0 ? [topicFilter] : [];
  }, [topicFilter, byCategory, nonEmptySlugs]);

  useEffect(() => {
    if (skipFilterScrollRef.current) {
      skipFilterScrollRef.current = false;
      return;
    }
    listAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [topicFilter]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllInCategory = useCallback((slug: string) => {
    const list = byCategory.get(slug) ?? [];
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = list.length > 0 && list.every((x) => next.has(x.id));
      if (allOn) {
        for (const x of list) next.delete(x.id);
      } else {
        for (const x of list) next.add(x.id);
      }
      return next;
    });
  }, [byCategory]);

  const selectedList = useMemo(
    () => items.filter((x) => selected.has(x.id)),
    [items, selected],
  );

  const exportMarkdown = useCallback(() => {
    if (selectedList.length === 0) return;
    const lines: string[] = [`# ${t("exportHeading")}`, "", `> ${t("exportGenerated")} ${new Date().toLocaleString()}`, ""];
    const bySelCat = new Map<string, BankItem[]>();
    for (const it of selectedList) {
      const slug = (QUESTION_TOPIC_ORDER as readonly string[]).includes(it.topicCategory)
        ? it.topicCategory
        : "other";
      const arr = bySelCat.get(slug) ?? [];
      arr.push(it);
      bySelCat.set(slug, arr);
    }
    for (const slug of QUESTION_TOPIC_ORDER) {
      const group = bySelCat.get(slug);
      if (!group?.length) continue;
      lines.push(`## ${tTopic(`topic_${slug as QuestionTopicSlug}`)}`, "");
      for (const it of group) {
        lines.push(`### ${it.title}`, "");
        lines.push(`- **${t("exportSession")}** ${it.projectTitle}`);
        lines.push(`- **${t("exportRound")}** ${it.round}`);
        if (it.userTurnCount > 0) {
          lines.push(`- **${t("exportUserTurns")}** ${it.userTurnCount}`);
        }
        const excerptBlock = it.answered
          ? formatPrepNoteForDisplay(it.assistantExcerpt)
          : t("exportNoAnswer");
        lines.push("", `**${t("exportAiExcerpt")}**`, "", excerptBlock, "", "---", "");
      }
    }
    downloadText(`question-bank-${new Date().toISOString().slice(0, 10)}.md`, lines.join("\n"));
    trackEvent("export_markdown", {
      source: "question_bank",
      selected_count: selectedList.length,
    });
  }, [selectedList, t, tTopic]);

  const totalItems = items.length;
  const answeredCount = useMemo(() => items.filter((x) => x.answered).length, [items]);

  return (
    <div className="min-h-full bg-[var(--background)]">
      <DraftNav variant="marketing" />
      <main id="main" className="mx-auto max-w-4xl px-4 pb-32 pt-24 md:px-8 md:pb-24">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/projects"
              className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
            >
              <MaterialIcon name="arrow_back" className="!text-lg" />
              {t("backProjects")}
            </Link>
            <h1 className="font-headline text-3xl font-medium text-[var(--on-surface)] md:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--on-surface-variant)]">{t("subtitle")}</p>
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
              {t("stats", { total: totalItems, answered: answeredCount })}
            </p>
          </div>
        </div>

        {loadError ? (
          <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadError}</div>
        ) : null}

        {loading ? (
          <div className="py-20 text-center text-sm text-[var(--on-surface-variant)]">…</div>
        ) : totalItems === 0 ? (
          <div className="rounded-2xl border border-[var(--outline-variant)]/15 bg-[var(--surface-container-low)] p-10 text-center">
            <MaterialIcon name="quiz" className="mx-auto !text-5xl text-[var(--outline-variant)]" />
            <p className="mt-4 text-sm text-[var(--on-surface-variant)]">{t("empty")}</p>
            <Link
              href="/projects"
              className="mt-6 inline-flex rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--on-primary)]"
            >
              {t("emptyCta")}
            </Link>
          </div>
        ) : (
          <>
            <div className="sticky top-[3.75rem] z-30 -mx-4 border-b border-[var(--outline-variant)]/10 bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-4 py-3 backdrop-blur-md md:top-20 md:-mx-8 md:px-8">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                {t("filterLabel")}
              </p>
              <div className="flex flex-wrap gap-2 md:flex-nowrap md:overflow-x-auto md:pb-1 md:scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setTopicFilter("all")}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition md:py-1.5 ${
                    topicFilter === "all"
                      ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                      : "border border-[var(--outline-variant)]/25 bg-[var(--surface-container-low)] text-[var(--on-surface)] hover:border-[var(--primary)]/25"
                  }`}
                >
                  {t("filterAll")}{" "}
                  <span className="tabular-nums opacity-90">({totalItems})</span>
                </button>
                {nonEmptySlugs.map((slug) => {
                  const n = byCategory.get(slug)?.length ?? 0;
                  const active = topicFilter === slug;
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => setTopicFilter(slug)}
                      className={`max-w-[min(100%,14rem)] shrink-0 truncate rounded-full px-3.5 py-2 text-left text-xs font-medium transition md:max-w-[11rem] md:py-1.5 ${
                        active
                          ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                          : "border border-[var(--outline-variant)]/25 bg-[var(--surface-container-low)] text-[var(--on-surface)] hover:border-[var(--primary)]/25"
                      }`}
                      title={tTopic(`topic_${slug}`)}
                    >
                      <span className="truncate">{tTopic(`topic_${slug}`)}</span>{" "}
                      <span className="tabular-nums opacity-90">({n})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={listAnchorRef} className="h-px w-full scroll-mt-28" aria-hidden />

            <div className="mt-6 space-y-10">
            {visibleSlugs.map((slug) => {
              const group = byCategory.get(slug) ?? [];
              if (group.length === 0) return null;
              const allSelected = group.every((x) => selected.has(x.id));
              return (
                <section key={slug} className="rounded-2xl border border-[var(--outline-variant)]/10 bg-[var(--surface-container-lowest)] p-4 shadow-sm md:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-headline text-lg font-semibold text-[var(--on-surface)] md:text-xl">
                      {tTopic(`topic_${slug}`)}
                    </h2>
                    <button
                      type="button"
                      onClick={() => selectAllInCategory(slug)}
                      className="text-xs font-medium text-[var(--primary)] underline-offset-4 hover:underline"
                    >
                      {allSelected ? t("deselectCategory") : t("selectCategory")}
                    </button>
                  </div>
                  <ul className="space-y-3">
                    {group.map((it) => {
                      const isSel = selected.has(it.id);
                      const isExp = expanded.has(it.id);
                      const excerpt = formatPrepNoteForDisplay(it.assistantExcerpt);
                      return (
                        <li
                          key={it.id}
                          className={`rounded-xl border bg-[var(--surface)] p-3 transition md:p-4 ${
                            isSel
                              ? "border-[color-mix(in_srgb,var(--primary)_35%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--primary)_18%,transparent)]"
                              : "border-[var(--outline-variant)]/12"
                          }`}
                        >
                          <div className="flex gap-3">
                            <label className="flex cursor-pointer items-start pt-0.5">
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => toggle(it.id)}
                                className="mt-1 h-4 w-4 rounded border-[var(--outline-variant)] text-[var(--primary)]"
                              />
                              <span className="sr-only">{t("selectQuestion")}</span>
                            </label>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-[var(--on-surface)]">{it.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--on-surface-variant)]">
                                <span className="rounded-md bg-[var(--surface-container-high)] px-2 py-0.5">
                                  {it.projectTitle}
                                </span>
                                <span>
                                  {t("roundLabel", { n: it.round })}
                                </span>
                                {!it.answered ? (
                                  <span className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-amber-950 dark:text-amber-100">
                                    {t("pendingBadge")}
                                  </span>
                                ) : null}
                                {it.userTurnCount > 0 ? (
                                  <span>{t("userTurns", { n: it.userTurnCount })}</span>
                                ) : null}
                              </div>
                              {it.answered && excerpt.length > 0 ? (
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(it.id)}
                                    className="text-left text-xs font-medium text-[var(--primary)]"
                                  >
                                    {isExp ? t("hideExcerpt") : t("showExcerpt")}
                                  </button>
                                  {isExp ? (
                                    <p className="mt-1 whitespace-pre-wrap rounded-lg bg-[var(--surface-container-low)] p-2 text-xs leading-relaxed text-[var(--on-surface-variant)]">
                                      {excerpt}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="mt-3">
                                <Link
                                  href={`/workspace?project=${it.projectId}&question=${it.id}`}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] underline-offset-4 hover:underline"
                                >
                                  <MaterialIcon name="open_in_new" className="!text-base" />
                                  {t("openInWorkspace")}
                                </Link>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            </div>
          </>
        )}
      </main>

      {!loading && totalItems > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--outline-variant)]/15 bg-[var(--surface)]/95 px-4 py-3 backdrop-blur-md md:px-8">
          <div className="mx-auto flex max-w-4xl flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("selectedCount", { n: selected.size })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={exportMarkdown}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-[var(--on-primary)] disabled:opacity-40 sm:flex-none"
              >
                <MaterialIcon name="download" className="!text-lg" />
                {t("exportMd")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
