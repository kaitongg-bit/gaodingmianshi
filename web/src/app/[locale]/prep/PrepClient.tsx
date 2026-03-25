"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { clampRoundsCount, MAX_INTERVIEW_ROUNDS } from "@/lib/project-rounds";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { DraftNav } from "@/components/DraftNav";
import { MaterialIcon } from "@/components/MaterialIcon";
import type { AnalysisPayload } from "@/lib/client-session";
import { PENDING_ROUND_SESSION_KEY } from "@/lib/projects-storage";
import {
  getDemoResumeAndJd,
  upgradeIfLegacyForkSeedTemplate,
  upgradeLegacyDemoJdEn,
} from "@/lib/demo-copy";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type QuestionItem = { id: string; round: number; title: string };

function mapAiError(
  err: string | undefined,
  t: ReturnType<typeof useTranslations<"Prep">>,
): string {
  if (err === "missing_api_key") return t("apiKeyMissing");
  if (err === "insufficient_credits") return t("insufficientCredits");
  if (err === "unauthorized") return t("loginRequired");
  return err ?? "error";
}

export function PrepClient() {
  const t = useTranslations("Prep");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("project");
  const messages = useMessages() as {
    Prep?: { thinkingSteps?: string[]; generatingSteps?: string[] };
  };
  const thinkingSteps = messages.Prep?.thinkingSteps ?? [];
  const generatingSteps = useMemo(
    () => messages.Prep?.generatingSteps ?? [],
    [messages],
  );

  const [projectId, setProjectId] = useState<string | null>(null);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [roundsCount, setRoundsCount] = useState(3);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingGen, setLoadingGen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [addRoundBusy, setAddRoundBusy] = useState(false);
  const [removeRoundBusy, setRemoveRoundBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [genThinkingStep, setGenThinkingStep] = useState(0);
  const [prepNoteModal, setPrepNoteModal] = useState<null | "focus" | "risk">(null);

  const handleAddRound = useCallback(async () => {
    if (!projectId) return;
    if (roundsCount >= MAX_INTERVIEW_ROUNDS) return;
    const next = roundsCount + 1;
    setAddRoundBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rounds_count: next }),
      });
      if (res.ok) {
        setRoundsCount(next);
      }
    } finally {
      setAddRoundBusy(false);
    }
  }, [projectId, roundsCount]);

  const handleRemoveRound = useCallback(
    async (round: number) => {
      if (!projectId || roundsCount <= 1) return;
      if (!window.confirm(tNav("removeRoundConfirm", { n: round }))) return;
      setRemoveRoundBusy(true);
      try {
        const del = await fetch(`/api/projects/${projectId}/rounds/${round}`, { method: "DELETE" });
        const dj = (await del.json()) as { error?: string; rounds_count?: number };
        if (!del.ok) {
          setError(
            dj.error === "cannot_remove_last_round" ? t("removeRoundLast") : t("removeRoundFailed"),
          );
          return;
        }
        if (typeof dj.rounds_count === "number") {
          setRoundsCount(clampRoundsCount(dj.rounds_count));
        } else {
          setRoundsCount((c) => Math.max(1, c - 1));
        }
        setError(null);
      } catch {
        setError("network");
      } finally {
        setRemoveRoundBusy(false);
      }
    },
    [projectId, roundsCount, t, tNav],
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoadError(null);
      if (projectIdParam) {
        if (!UUID_RE.test(projectIdParam)) {
          router.replace("/prep");
          return;
        }
        setProjectId(projectIdParam);
        setBootstrapDone(true);
        return;
      }
      const listR = await fetch(`/api/projects?locale=${encodeURIComponent(locale)}`);
      const listJ = (await listR.json()) as { projects?: { id: string }[] };
      if (cancelled) return;
      if (listR.ok && listJ.projects?.length) {
        const id = listJ.projects[0].id;
        router.replace(`/prep?project=${id}`);
        setProjectId(id);
        setBootstrapDone(true);
        return;
      }
      const { resume: demoResume, jd: demoJd } = getDemoResumeAndJd(locale);
      const c = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: demoResume,
          jd_text: demoJd,
        }),
      });
      const cj = (await c.json()) as { id?: string; error?: string };
      if (cancelled) return;
      if (c.ok && cj.id) {
        router.replace(`/prep?project=${cj.id}`);
        setProjectId(cj.id);
      } else {
        setLoadError(cj.error ?? "bootstrap_failed");
      }
      setBootstrapDone(true);
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [projectIdParam, locale, router]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setHydrated(false);
    void (async () => {
      const r = await fetch(`/api/projects/${projectId}`);
      const j = (await r.json()) as {
        project?: {
          resume_text?: string;
          jd_text?: string;
          rounds_count?: number;
          analysis_jsonb?: unknown;
          question_count?: number;
        };
        error?: string;
      };
      if (cancelled) return;
      if (!r.ok || !j.project) {
        setLoadError(j.error ?? "load_failed");
        setHydrated(true);
        return;
      }
      const p = j.project;
      const r0 = (p.resume_text ?? "").trim();
      const j0 = (p.jd_text ?? "").trim();
      const forkDemo = upgradeIfLegacyForkSeedTemplate(
        p.resume_text ?? "",
        p.jd_text ?? "",
        locale,
      );
      const jdUpgraded = upgradeLegacyDemoJdEn(p.jd_text ?? "");
      if (forkDemo) {
        setResume(forkDemo.resume);
        setJd(forkDemo.jd);
        void fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume_text: forkDemo.resume,
            jd_text: forkDemo.jd,
          }),
        });
      } else if (jdUpgraded) {
        setResume(p.resume_text ?? "");
        setJd(jdUpgraded);
        void fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd_text: jdUpgraded }),
        });
      } else if (!r0 && !j0) {
        const { resume: dr, jd: dj } = getDemoResumeAndJd(locale);
        setResume(dr);
        setJd(dj);
      } else {
        setResume(p.resume_text ?? "");
        setJd(p.jd_text ?? "");
      }
      setRoundsCount(clampRoundsCount(Number(p.rounds_count) || 3));
      {
        const raw = p.analysis_jsonb;
        let parsed: AnalysisPayload | null = null;
        if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
          parsed = raw as AnalysisPayload;
        } else if (typeof raw === "string") {
          try {
            const o = JSON.parse(raw) as unknown;
            if (o && typeof o === "object" && !Array.isArray(o)) parsed = o as AnalysisPayload;
          } catch {
            parsed = null;
          }
        }
        setAnalysis(parsed);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, locale]);

  useEffect(() => {
    const n = Math.max(1, thinkingSteps.length);
    if (loadingAnalyze) {
      setThinkingStep(0);
      timerRef.current = setInterval(() => setThinkingStep((s) => (s + 1) % n), 900);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadingAnalyze, thinkingSteps.length]);

  useEffect(() => {
    if (!loadingGen) {
      if (genTimerRef.current) {
        clearInterval(genTimerRef.current);
        genTimerRef.current = null;
      }
      return;
    }
    const steps =
      generatingSteps.length > 0 ? generatingSteps : [t("generatingQuestions")];
    setGenThinkingStep(0);
    const n = Math.max(1, steps.length);
    genTimerRef.current = setInterval(() => setGenThinkingStep((s) => (s + 1) % n), 900);
    return () => {
      if (genTimerRef.current) {
        clearInterval(genTimerRef.current);
        genTimerRef.current = null;
      }
    };
  }, [loadingGen, generatingSteps, t]);

  useEffect(() => {
    if (!prepNoteModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPrepNoteModal(null);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [prepNoteModal]);

  useEffect(() => {
    if (!projectId || !hydrated) return;
    const id = window.setTimeout(() => {
      void fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resume,
          jd_text: jd,
          rounds_count: roundsCount,
          analysis_jsonb: analysis,
        }),
      });
    }, 650);
    return () => window.clearTimeout(id);
  }, [resume, jd, roundsCount, analysis, projectId, hydrated]);

  /** 有 project 即可进工作区切换轮次（不再依赖题目数/分析结构，避免顶栏 Round 长期不可点） */
  const onRoundFromPrep = useCallback(
    (r: number) => {
      if (!projectId) return;
      sessionStorage.setItem(PENDING_ROUND_SESSION_KEY, String(r));
      router.push(`/workspace?project=${projectId}`);
    },
    [projectId, router],
  );

  const runAnalyze = useCallback(async () => {
    setError(null);
    setLoadingAnalyze(true);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jd, locale }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: AnalysisPayload;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(mapAiError(json.error ?? json.message, t));
        return;
      }
      if (json.data) {
        setAnalysis(json.data);
        if (projectId) {
          const d = json.data;
          const suggest =
            (d.overallFit?.label && String(d.overallFit.label).trim().slice(0, 80)) ||
            (d.overallFit?.oneLiner && String(d.overallFit.oneLiner).trim().slice(0, 80));
          if (suggest) {
            void fetch(`/api/projects/${projectId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ display_title_if_empty: suggest }),
            });
          }
        }
      }
    } catch {
      setError("network");
    } finally {
      setLoadingAnalyze(false);
    }
  }, [resume, jd, locale, t, projectId]);

  const confirmAndGenerate = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    setLoadingGen(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resume,
          jd_text: jd,
          rounds_count: roundsCount,
          analysis_jsonb: analysis,
        }),
      });

      let existingQuestionTitles: string[] = [];
      try {
        const wr = await fetch(`/api/projects/${projectId}/workspace`);
        const wj = (await wr.json()) as { questions?: { title?: string }[] };
        if (wr.ok && Array.isArray(wj.questions)) {
          existingQuestionTitles = wj.questions
            .map((q) => (q.title ?? "").trim())
            .filter(Boolean);
        }
      } catch {
        /* 无已有题目时忽略 */
      }

      const res = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          jd,
          locale,
          rounds: roundsCount,
          analysis,
          existingQuestionTitles,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        questions?: QuestionItem[];
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(mapAiError(json.error ?? json.message, t));
        return;
      }
      if (!json.questions?.length) return;

      const put = await fetch(`/api/projects/${projectId}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: json.questions.map((q) => ({ title: q.title, round: q.round })),
        }),
      });
      const putJ = (await put.json()) as {
        questions?: unknown[];
        totalCount?: number;
        error?: string;
      };
      if (!put.ok) {
        setError(putJ.error ?? "save_questions_failed");
        return;
      }
      router.push(`/workspace?project=${projectId}`);
    } catch {
      setError("network");
    } finally {
      setLoadingGen(false);
    }
  }, [resume, jd, locale, roundsCount, analysis, projectId, router, t]);

  const score = analysis?.overallFit?.score0to100 ?? 0;
  const dims = analysis?.dimensions ?? [];

  const focusNoteFull = (
    analysis?.prepNotes?.likelyQuestionThemes ||
    analysis?.prepNotes?.strengths ||
    ""
  ).trim();
  const riskNoteFull = (analysis?.prepNotes?.gaps || "").trim();
  const focusPreview = focusNoteFull || "—";
  const riskPreview = riskNoteFull || "—";

  const modalBody =
    prepNoteModal === "focus"
      ? focusNoteFull || "—"
      : prepNoteModal === "risk"
        ? riskNoteFull || "—"
        : "";
  const modalTitle =
    prepNoteModal === "focus" ? t("focusArea") : prepNoteModal === "risk" ? t("riskFactor") : "";

  if (!bootstrapDone || !projectId || !hydrated) {
    return (
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--background)]">
        <DraftNav
          variant="app"
          activeStep="prep"
          roundsCount={roundsCount}
          onRoundSelect={projectId ? onRoundFromPrep : undefined}
          prepProjectId={projectId ?? undefined}
          onAddRound={projectId ? handleAddRound : undefined}
          addRoundBusy={addRoundBusy}
          onRemoveRound={projectId ? handleRemoveRound : undefined}
          removeRoundBusy={removeRoundBusy}
        />
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 pt-24 text-sm text-[var(--on-surface-variant)]">
          {loadError ?? "…"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--background)]">
      <DraftNav
        variant="app"
        activeStep="prep"
        roundsCount={roundsCount}
        onRoundSelect={onRoundFromPrep}
        prepProjectId={projectId}
        onAddRound={projectId ? handleAddRound : undefined}
        addRoundBusy={addRoundBusy}
        onRemoveRound={handleRemoveRound}
        removeRoundBusy={removeRoundBusy}
      />
      <main
        id="main"
        className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col overflow-hidden px-4 pb-4 pt-24 md:px-8"
      >
        {loadError ? (
          <div className="mb-3 shrink-0 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {loadError}
          </div>
        ) : null}
        {error ? (
          <div className="mb-3 shrink-0 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">{error}</div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden md:grid-cols-12 md:gap-8">
          <section className="flex min-h-0 flex-col overflow-hidden md:col-span-5">
            <div className="flex shrink-0 items-end justify-between border-b border-[var(--outline-variant)]/30 pb-3">
              <h1 className="font-headline text-2xl font-medium tracking-tight md:text-3xl">
                {t("stageAssets")}
              </h1>
              <span className="text-xs uppercase tracking-widest text-[var(--on-surface-variant)] md:text-sm">
                {t("analysisVer")}
              </span>
            </div>

            <div className="mt-4 shrink-0 space-y-3">
              <div className="flex shrink-0 items-center gap-2">
                <MaterialIcon name="description" className="shrink-0 text-[var(--primary)]" />
                <h2 className="font-headline text-lg md:text-xl">{t("resume")}</h2>
              </div>
              <div className="space-y-2 rounded-xl bg-[var(--surface-container-low)] p-4">
                <label className="text-[10px] font-medium uppercase tracking-widest text-[var(--on-surface-variant)] md:text-xs">
                  {t("resumeHint")}
                </label>
                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder={t("resumePlaceholder")}
                  className="h-36 w-full resize-none rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] p-3 text-sm leading-relaxed text-[var(--on-surface)] outline-none ring-0 focus:ring-1 focus:ring-[var(--primary)]/30 md:h-40"
                />
              </div>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex shrink-0 items-center gap-2">
                <MaterialIcon name="article" className="text-[var(--primary)]" />
                <h2 className="font-headline text-lg md:text-xl">{t("jd")}</h2>
              </div>
              <div className="flex min-h-0 flex-1 flex-col rounded-xl bg-[var(--surface-container-low)] p-4">
                <label className="mb-2 shrink-0 text-[10px] font-medium uppercase tracking-widest text-[var(--on-surface-variant)] md:text-xs">
                  {t("jdLabel")}
                </label>
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder={t("jdPlaceholder")}
                  className="min-h-0 w-full flex-1 resize-none rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] p-3 text-sm leading-relaxed text-[var(--on-surface)] outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                />
              </div>
            </div>

            <div className="mt-3 shrink-0 space-y-1.5">
              <div className="flex min-h-[2.75rem] flex-col justify-end gap-0.5">
                {loadingAnalyze && thinkingSteps.length > 0 ? (
                  <p className="text-center text-[10px] leading-tight text-[var(--on-surface-variant)]">
                    {thinkingSteps[thinkingStep % thinkingSteps.length]}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void runAnalyze()}
                disabled={loadingAnalyze}
                className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[var(--outline-variant)]/40 px-3 py-2 text-center text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--surface-container-low)] disabled:opacity-50"
              >
                {loadingAnalyze ? t("analyzing") : t("runAnalysis")}
              </button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden md:col-span-7">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pr-1 scrollbar-thin">
              <div className="relative flex flex-col items-stretch justify-between gap-6 overflow-hidden rounded-xl bg-[var(--primary)] p-6 text-[var(--on-primary)] shadow-[var(--shadow-card)] md:flex-row md:items-center md:p-8">
                <div className="relative z-10 max-w-md">
                  <h2 className="font-headline text-xl md:text-3xl">{t("strategicTitle")}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--on-primary)]/90">
                    {analysis
                      ? t("strategicBody", { score: String(score) })
                      : locale === "zh"
                        ? "运行分析后，将在此展示与岗位的匹配摘要。"
                        : "Run analysis to see how your materials align with the role."}
                  </p>
                  <p className="mt-2 text-xs opacity-80">{t("disclaimer")}</p>
                </div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[var(--primary-container)]/40 md:h-28 md:w-28">
                    <span className="font-headline text-3xl font-bold md:text-4xl">
                      {analysis ? score : "—"}
                    </span>
                  </div>
                  <span className="mt-2 text-[10px] font-medium uppercase tracking-widest text-[var(--on-primary)]/70">
                    {t("matchScore")}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--surface-container)] p-6 md:p-8">
                <h2 className="font-headline mb-5 text-xl md:text-2xl">{t("distributionTitle")}</h2>
                <div className="space-y-5">
                  {(dims.length
                    ? dims.slice(0, 4)
                    : [
                        { name: "Experience", level: "40%", detail: "" },
                        { name: "Technical", level: "30%", detail: "" },
                        { name: "Culture", level: "15%", detail: "" },
                        { name: "Scenario", level: "15%", detail: "" },
                      ]
                  ).map((d, i) => (
                    <div key={`${d.name}-${i}`} className="space-y-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium text-[var(--on-surface)]">{d.name}</span>
                        <span className="shrink-0 text-[var(--on-surface-variant)]">{d.level}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container-highest)]">
                        <div
                          className="h-full rounded-full bg-[var(--primary)]"
                          style={{ width: `${20 + i * 20}%` }}
                        />
                      </div>
                      {d.detail ? (
                        <p className="line-clamp-3 text-xs leading-relaxed text-[var(--on-surface-variant)]">
                          {d.detail}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
                {analysis?.prepNotes ? (
                  <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      className="rounded-lg border-l-4 border-[var(--primary)]/25 bg-[var(--surface-container-lowest)] p-4 text-left transition hover:bg-[var(--surface-container-high)]/50"
                      onClick={() => setPrepNoteModal("focus")}
                    >
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                        {t("focusArea")}
                      </p>
                      <p className="line-clamp-4 text-sm font-medium text-[var(--on-surface)]">
                        {focusPreview}
                      </p>
                      <p className="mt-2 text-[10px] text-[var(--primary)]">{t("analysisDetailHint")}</p>
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border-l-4 border-[var(--primary)]/25 bg-[var(--surface-container-lowest)] p-4 text-left transition hover:bg-[var(--surface-container-high)]/50"
                      onClick={() => setPrepNoteModal("risk")}
                    >
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                        {t("riskFactor")}
                      </p>
                      <p className="line-clamp-4 text-sm font-medium text-[var(--on-surface)]">
                        {riskPreview}
                      </p>
                      <p className="mt-2 text-[10px] text-[var(--primary)]">{t("analysisDetailHint")}</p>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 space-y-1.5 border-t border-transparent pt-3">
              <div className="flex min-h-[2.75rem] flex-col justify-end gap-0.5">
                <p className="line-clamp-3 text-center text-[10px] leading-tight text-[var(--on-surface-variant)]">
                  {t("confirmHint")}
                </p>
                {loadingGen && generatingSteps.length > 0 ? (
                  <p className="text-center text-[10px] leading-tight text-[var(--on-surface-variant)]">
                    {generatingSteps[genThinkingStep % generatingSteps.length]}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void confirmAndGenerate()}
                disabled={loadingGen}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-center text-sm font-medium text-[var(--on-primary)] shadow-lg transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50 md:gap-3 md:text-base"
              >
                {loadingGen ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="inline-flex h-5 items-end gap-1" aria-hidden>
                      <span
                        className="chat-bounce-dot inline-block h-2 w-2 rounded-full bg-[var(--on-primary)]/90"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="chat-bounce-dot inline-block h-2 w-2 rounded-full bg-[var(--on-primary)]/90"
                        style={{ animationDelay: "0.12s" }}
                      />
                      <span
                        className="chat-bounce-dot inline-block h-2 w-2 rounded-full bg-[var(--on-primary)]/90"
                        style={{ animationDelay: "0.24s" }}
                      />
                    </span>
                    <span>{t("generatingQuestions")}</span>
                  </span>
                ) : (
                  <>
                    {t("confirmCta")}
                    <MaterialIcon name="auto_awesome" />
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </main>

      {prepNoteModal ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prep-note-modal-title"
          onClick={() => setPrepNoteModal(null)}
        >
          <div
            className="max-h-[min(72vh,520px)] w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--surface-container-lowest)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--outline-variant)]/20 px-4 py-3">
              <h2 id="prep-note-modal-title" className="font-headline text-lg font-medium text-[var(--on-surface)]">
                {modalTitle}
              </h2>
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                onClick={() => setPrepNoteModal(null)}
                aria-label={t("analysisDetailClose")}
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            <div className="max-h-[min(60vh,440px)] overflow-y-auto px-4 py-4 scrollbar-thin">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--on-surface)]">{modalBody}</p>
            </div>
            <div className="border-t border-[var(--outline-variant)]/20 px-4 py-3">
              <button
                type="button"
                className="w-full rounded-xl bg-[var(--primary)] py-2.5 text-sm font-medium text-[var(--on-primary)]"
                onClick={() => setPrepNoteModal(null)}
              >
                {t("analysisDetailClose")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
