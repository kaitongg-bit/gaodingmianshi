"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { DraftNav } from "@/components/DraftNav";
import { MaterialIcon } from "@/components/MaterialIcon";
import type { AnalysisPayload } from "@/lib/client-session";
import { PENDING_ROUND_SESSION_KEY } from "@/lib/projects-storage";

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
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("project");
  const messages = useMessages() as { Prep?: { thinkingSteps?: string[] } };
  const thinkingSteps = messages.Prep?.thinkingSteps ?? [];

  const [projectId, setProjectId] = useState<string | null>(null);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [roundsCount, setRoundsCount] = useState(3);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingGen, setLoadingGen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [newSessionBusy, setNewSessionBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleNewSession = useCallback(async () => {
    setNewSessionBusy(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = (await r.json()) as { id?: string };
      if (r.ok && j.id) {
        router.push(`/prep?project=${j.id}`);
      }
    } finally {
      setNewSessionBusy(false);
    }
  }, [router]);

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
      const c = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
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
      setResume(p.resume_text ?? "");
      setJd(p.jd_text ?? "");
      setRoundsCount(Math.min(5, Math.max(1, Number(p.rounds_count) || 3)));
      setAnalysis((p.analysis_jsonb ?? null) as AnalysisPayload | null);
      setQuestionCount(typeof p.question_count === "number" ? p.question_count : 0);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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

  const canJumpToWorkspaceRounds = questionCount > 0;

  const onRoundFromPrep = useCallback(
    (r: number) => {
      if (!canJumpToWorkspaceRounds || !projectId) return;
      sessionStorage.setItem(PENDING_ROUND_SESSION_KEY, String(r));
      router.push(`/workspace?project=${projectId}`);
    },
    [canJumpToWorkspaceRounds, projectId, router],
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

      const res = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          jd,
          locale,
          rounds: roundsCount,
          analysis,
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
      const putJ = (await put.json()) as { questions?: unknown[]; error?: string };
      if (!put.ok) {
        setError(putJ.error ?? "save_questions_failed");
        return;
      }
      setQuestionCount(Array.isArray(putJ.questions) ? putJ.questions.length : json.questions.length);
      router.push(`/workspace?project=${projectId}`);
    } catch {
      setError("network");
    } finally {
      setLoadingGen(false);
    }
  }, [resume, jd, locale, roundsCount, analysis, projectId, router, t]);

  const score = analysis?.overallFit?.score0to100 ?? 0;
  const dims = analysis?.dimensions ?? [];

  if (!bootstrapDone || !projectId || !hydrated) {
    return (
      <div className="min-h-full bg-[var(--background)]">
        <DraftNav
          variant="app"
          activeStep="prep"
          roundsCount={roundsCount}
          prepProjectId={projectId ?? undefined}
          onNewSession={handleNewSession}
          newSessionBusy={newSessionBusy}
        />
        <div className="flex min-h-[50vh] items-center justify-center px-4 pt-24 text-sm text-[var(--on-surface-variant)]">
          {loadError ?? "…"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[var(--background)]">
      <DraftNav
        variant="app"
        activeStep="prep"
        roundsCount={roundsCount}
        onRoundSelect={canJumpToWorkspaceRounds ? onRoundFromPrep : undefined}
        prepProjectId={projectId}
        onNewSession={handleNewSession}
        newSessionBusy={newSessionBusy}
      />
      <main id="main" className="mx-auto max-w-screen-2xl px-4 pb-16 pt-24 md:px-8">
        {loadError ? (
          <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadError}</div>
        ) : null}
        {error && (
          <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">{error}</div>
        )}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <section className="space-y-10 md:col-span-5">
            <div className="flex items-end justify-between border-b border-[var(--outline-variant)]/30 pb-4">
              <h1 className="font-headline text-3xl font-medium tracking-tight md:text-4xl">
                {t("stageAssets")}
              </h1>
              <span className="text-sm uppercase tracking-widest text-[var(--on-surface-variant)]">
                {t("analysisVer")}
              </span>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon name="description" className="text-[var(--primary)]" />
                  <h2 className="font-headline text-2xl">{t("resume")}</h2>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/5"
                >
                  <MaterialIcon name="upload" className="!text-base" />
                  {t("uploadResume")}
                </button>
              </div>
              <div className="space-y-3 rounded-xl bg-[var(--surface-container-low)] p-6">
                <label className="text-xs font-medium uppercase tracking-widest text-[var(--on-surface-variant)]">
                  {t("resumeHint")}
                </label>
                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder={t("resumePlaceholder")}
                  className="h-40 w-full resize-none rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] p-4 text-sm leading-relaxed text-[var(--on-surface)] outline-none ring-0 focus:ring-1 focus:ring-[var(--primary)]/30"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <MaterialIcon name="article" className="text-[var(--primary)]" />
                <h2 className="font-headline text-2xl">{t("jd")}</h2>
              </div>
              <div className="rounded-xl bg-[var(--surface-container-low)] p-6">
                <label className="mb-3 block text-xs font-medium uppercase tracking-widest text-[var(--on-surface-variant)]">
                  {t("jdLabel")}
                </label>
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder={t("jdPlaceholder")}
                  className="h-64 w-full resize-none rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] p-4 text-sm leading-relaxed text-[var(--on-surface)] outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void runAnalyze()}
              disabled={loadingAnalyze}
              className="w-full rounded-xl border border-[var(--outline-variant)]/40 py-3 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--surface-container-low)] disabled:opacity-50"
            >
              {loadingAnalyze ? t("analyzing") : t("runAnalysis")}
            </button>
            {loadingAnalyze && thinkingSteps.length > 0 && (
              <p className="text-xs text-[var(--on-surface-variant)]">
                {thinkingSteps[thinkingStep % thinkingSteps.length]}
              </p>
            )}
          </section>

          <section className="space-y-8 md:col-span-7">
            <div className="relative flex flex-col items-stretch justify-between gap-6 overflow-hidden rounded-xl bg-[var(--primary)] p-8 text-[var(--on-primary)] shadow-[var(--shadow-card)] md:flex-row md:items-center">
              <div className="relative z-10 max-w-md">
                <h2 className="font-headline text-2xl md:text-3xl">{t("strategicTitle")}</h2>
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
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-[var(--primary-container)]/40">
                  <span className="font-headline text-4xl font-bold">{analysis ? score : "—"}</span>
                </div>
                <span className="mt-2 text-[10px] font-medium uppercase tracking-widest text-[var(--on-primary)]/70">
                  {t("matchScore")}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-[var(--surface-container)] p-8">
              <h2 className="font-headline mb-6 text-2xl">{t("distributionTitle")}</h2>
              <div className="space-y-6">
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
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-[var(--on-surface)]">{d.name}</span>
                      <span className="text-[var(--on-surface-variant)]">{d.level}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container-highest)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${20 + i * 20}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {analysis?.prepNotes && (
                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border-l-4 border-[var(--primary)]/25 bg-[var(--surface-container-lowest)] p-5">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                      {t("focusArea")}
                    </p>
                    <p className="text-sm font-medium text-[var(--on-surface)]">
                      {(analysis.prepNotes.likelyQuestionThemes || analysis.prepNotes.strengths || "—").slice(
                        0,
                        120,
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border-l-4 border-[var(--primary)]/25 bg-[var(--surface-container-lowest)] p-5">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                      {t("riskFactor")}
                    </p>
                    <p className="text-sm font-medium text-[var(--on-surface)]">
                      {(analysis.prepNotes.gaps || "—").slice(0, 120)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void confirmAndGenerate()}
                disabled={loadingGen}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--primary)] py-5 text-lg font-medium text-[var(--on-primary)] shadow-lg transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
              >
                {loadingGen ? t("analyzing") : t("confirmCta")}
                <MaterialIcon name="auto_awesome" />
              </button>
              <p className="text-center text-xs text-[var(--on-surface-variant)]">{t("confirmHint")}</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
