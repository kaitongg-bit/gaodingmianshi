"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const CARD_TAIL_WIDTHS = [88, 100, 72, 94, 68] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

/**
 * 第一题：用户卡壳 → AI 给出提纲 + 逐字稿 + 追问（成品，非说教）→ 用户不再说话 → 写入逐字稿 → 右侧仅骨架示意。
 * 问题列表第 2、3 题为横条占位。第二题：对话 + AI 产出全骨架，再写入，新卡片置顶且全占位。
 */
export function LandingHeroMockup() {
  const t = useTranslations("Landing");
  const reducedMotion = usePrefersReducedMotion();
  const [hover, setHover] = useState(false);
  const [phase, setPhase] = useState(0);
  const [segment, setSegment] = useState<"workspace" | "prep">("workspace");
  const [prepPhase, setPrepPhase] = useState(0);
  const [uiFlash, setUiFlash] = useState(false);
  const hoverRef = useRef(false);

  const onEnter = useCallback(() => {
    hoverRef.current = true;
    setHover(true);
  }, []);

  const onLeave = useCallback(() => {
    hoverRef.current = false;
    setHover(false);
    setPhase(0);
    setPrepPhase(0);
    setSegment("workspace");
    setUiFlash(false);
  }, []);

  useEffect(() => {
    if (segment !== "workspace" || (phase !== 4 && phase !== 10)) return;
    setUiFlash(true);
    const timer = window.setTimeout(() => setUiFlash(false), 720);
    return () => window.clearTimeout(timer);
  }, [phase, segment]);

  useEffect(() => {
    if (!hover || reducedMotion) {
      setPhase(0);
      setPrepPhase(0);
      setSegment("workspace");
      return;
    }

    const PHASE_MS = [900, 780, 3600, 1000, 950, 800, 700, 780, 2200, 900, 1100, 2200];
        const PREP_MS = [650, 750, 800, 2600, 1000, 900];
    let cancelled = false;

    (async () => {
      while (!cancelled && hoverRef.current) {
        setSegment("workspace");
        for (let p = 0; p <= 11; p++) {
          if (cancelled || !hoverRef.current) break;
          setPhase(p);
          await sleep(PHASE_MS[p] ?? 900);
        }
        if (cancelled || !hoverRef.current) break;
        await sleep(450);
        if (cancelled || !hoverRef.current) break;

        setSegment("prep");
        for (let pp = 0; pp < PREP_MS.length; pp++) {
          if (cancelled || !hoverRef.current) break;
          setPrepPhase(pp);
          await sleep(PREP_MS[pp] ?? 800);
        }
        if (cancelled || !hoverRef.current) break;
        await sleep(2000);
        if (cancelled || !hoverRef.current) break;
        setSegment("workspace");
        setPhase(0);
        setPrepPhase(0);
      }
      if (!hoverRef.current) {
        setPhase(0);
        setPrepPhase(0);
        setSegment("workspace");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hover, reducedMotion]);

  const activeQ = phase <= 4 ? 0 : 1;
  const q2JustSelected = phase === 5;
  const middleEmpty = phase === 5;
  const showExport = (phase >= 3 && phase <= 4) || (phase >= 9 && phase <= 10);
  const typingQ1 = phase === 1;
  const typingQ2 = phase === 7;
  const typing = typingQ1 || typingQ2;

  const showQ1Deliverable = phase >= 2 && !(typingQ1 && phase === 1);
  const showQ2User = phase >= 6;
  const showQ2AiSkeleton = phase >= 8 && !typingQ2;

  const scriptCount = phase >= 10 ? 2 : phase >= 4 ? 1 : 0;

  return (
    <div
      className="relative w-full"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <p
        className={`mb-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--on-surface-variant)] transition-opacity duration-300 sm:text-xs ${
          hover ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden
      >
        {t("heroMockHoverHint")}
      </p>

      <div className="group relative">
        <div
          className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] blur-3xl transition-colors duration-500 group-hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] motion-reduce:transition-none"
          aria-hidden
        />

        <div
          className="relative flex h-[min(580px,82svh)] min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-[var(--outline-variant)]/10 bg-[var(--surface-container-lowest)] shadow-2xl transition-[box-shadow] duration-500 group-hover:shadow-[0_24px_64px_rgba(49,51,44,0.12)]"
          role="img"
          aria-label={segment === "prep" ? t("heroPrepAria") : t("heroImageAlt")}
        >
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--surface-container-high)] px-4">
            <div
              className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--error)_20%,transparent)]"
              aria-hidden
            />
            <div
              className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--tertiary)_20%,transparent)]"
              aria-hidden
            />
            <div
              className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
              aria-hidden
            />
          </div>

          {segment === "prep" ? (
            <PrepWorkspaceMock prepPhase={prepPhase} t={t} />
          ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* 左：仅第一题展示真文案，其余为横条占位 */}
            <div className="w-[24%] min-w-[5.5rem] shrink-0 space-y-2 border-r border-[var(--surface-container-high)] p-2 sm:min-w-[6.5rem] sm:space-y-3 sm:p-3 md:w-[23%]">
              <p className="truncate text-[9px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)] sm:text-[10px]">
                {t("heroMockPaneQuestions")}
              </p>
              <div className="w-full min-w-0 space-y-2" role="list" aria-hidden>
                {[0, 1, 2].map((i) => {
                  const selected = activeQ === i;
                  const pulse = q2JustSelected && i === 1;
                  return (
                    <div
                      key={i}
                      role="listitem"
                      className={`w-full min-w-0 rounded-lg border px-2 py-2 text-left transition-all duration-300 sm:px-2.5 sm:py-2.5 ${
                        selected
                          ? "border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--on-surface)]"
                          : "border-transparent bg-[color-mix(in_srgb,var(--primary)_4%,transparent)] text-[var(--on-surface-variant)]"
                      } ${pulse ? "motion-safe:animate-[hero-mock-tap_0.55s_ease-out]" : ""}`}
                    >
                      {i === 0 ? (
                        <p className="line-clamp-3 text-[8px] leading-snug sm:text-[10px]">{t("heroMockQ1")}</p>
                      ) : (
                        <QuestionRowSkeleton />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 中 */}
            <div className="flex min-w-0 flex-1 flex-col bg-[color-mix(in_srgb,var(--surface-container-low)_30%,transparent)]">
              <div className="min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-4">
                {middleEmpty ? (
                  <div className="flex h-full min-h-[8rem] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--outline-variant)]/35 bg-[color-mix(in_srgb,var(--surface-container-low)_40%,transparent)] px-3 py-6 text-center motion-safe:animate-[hero-mock-in_0.4s_ease-out]">
                    <p className="max-w-[14rem] text-[9px] leading-relaxed text-[var(--on-surface-variant)] sm:text-[11px]">
                      {t("heroMockMiddleEmptyHint")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {phase <= 4 ? (
                      <>
                        <div className="flex justify-end">
                          <p className="max-w-[94%] rounded-2xl rounded-tr-none bg-[var(--primary)] px-2.5 py-2 text-[9px] leading-snug text-[var(--on-primary)] sm:max-w-[90%] sm:px-3 sm:text-[11px]">
                            {t("heroMockUserStuck")}
                          </p>
                        </div>
                        {typingQ1 && <TypingDots />}
                        {showQ1Deliverable && (
                          <div className="flex justify-start motion-safe:animate-[hero-mock-in_0.4s_ease-out]">
                            <Q1DeliverableCard t={t} />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {showQ2User && (
                          <div className="flex justify-end motion-safe:animate-[hero-mock-in_0.35s_ease-out]">
                            <p className="max-w-[94%] rounded-2xl rounded-tr-none bg-[var(--primary)] px-2.5 py-2 text-[9px] leading-snug text-[var(--on-primary)] sm:max-w-[90%] sm:px-3 sm:text-[11px]">
                              {t("heroMockUserQ2Short")}
                            </p>
                          </div>
                        )}
                        {typingQ2 && <TypingDots />}
                        {showQ2AiSkeleton && (
                          <div className="flex justify-start motion-safe:animate-[hero-mock-in_0.4s_ease-out]">
                            <AiSkeletonDeliverable t={t} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {showExport && (
                <div
                  className={`mx-2.5 mb-2 rounded-xl border border-[var(--outline-variant)]/20 bg-[var(--surface-container-lowest)] px-2.5 py-2 sm:mx-3 ${
                    uiFlash ? "motion-safe:animate-[hero-mock-flash_0.72s_ease-out]" : ""
                  }`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[8px] text-[var(--on-surface-variant)] sm:text-[10px]">
                      {t("heroMockWriteTranscriptSub")}
                    </span>
                    <span className="w-fit rounded-lg bg-[var(--primary)] px-2.5 py-1.5 text-[8px] font-medium text-[var(--on-primary)] sm:text-[10px]">
                      {t("heroMockWriteTranscript")}
                    </span>
                  </div>
                </div>
              )}

              <div
                className={`mx-2.5 mb-2.5 flex h-9 shrink-0 items-center rounded-full border px-3 sm:mx-3 sm:mb-3 ${
                  typing
                    ? "border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[var(--surface-container-lowest)]"
                    : "border-[var(--outline-variant)]/20 bg-[var(--surface-container-lowest)]"
                }`}
                aria-hidden
              >
                <div
                  className={`h-1.5 rounded-full bg-[var(--surface-container-high)] transition-all duration-300 ${
                    typing ? "w-3/4 motion-safe:animate-pulse" : "w-1/3"
                  }`}
                />
              </div>
            </div>

            {/* 右：仅标题可辨，正文一律骨架；第二卡全占位 */}
            <div
              className={`w-[34%] min-w-[6.75rem] shrink-0 border-l border-[var(--surface-container-high)] p-2.5 transition-[background-color] duration-500 sm:min-w-[8.25rem] sm:p-3 md:w-[33%] ${
                scriptCount > 0
                  ? "bg-[color-mix(in_srgb,var(--primary-container)_35%,var(--surface))]"
                  : "bg-[var(--surface)]"
              } ${uiFlash ? "motion-safe:animate-[hero-mock-flash_0.72s_ease-out]" : ""}`}
            >
              <p className="mb-2 font-headline text-[10px] font-semibold leading-tight text-[var(--on-surface)] sm:mb-3 sm:text-xs">
                {t("heroMockPaneScript")}
              </p>

              {scriptCount === 0 ? (
                <div className="space-y-2 pt-0.5" aria-hidden>
                  <div className="h-2 w-full rounded bg-[var(--surface-container-high)]" />
                  <div className="h-2 w-[92%] rounded bg-[var(--surface-container-high)]" />
                  <div className="h-2 w-4/5 rounded bg-[var(--surface-container-high)]" />
                </div>
              ) : (
                <div className="flex max-h-[min(300px,48svh)] flex-col gap-2 overflow-y-auto pr-0.5">
                  {scriptCount >= 2 && (
                    <ScriptCardFullyPlaceholder
                      newest
                      newestLabel={t("heroMockScriptBadgeNew")}
                    />
                  )}
                  <ScriptCardIntroTitleOnly
                    title={t("heroMockRightCardTitle1")}
                    newest={false}
                    newestLabel={t("heroMockScriptBadgeNew")}
                    className={scriptCount >= 2 ? "motion-safe:animate-[hero-mock-in_0.45s_ease-out]" : undefined}
                  />
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 准备页两栏：布局对齐 PrepClient（5/12 + 7/12），仅骨架无正文 */
function PrepWorkspaceMock({
  prepPhase,
  t,
}: {
  prepPhase: number;
  t: ReturnType<typeof useTranslations<"Landing">>;
}) {
  const resumeGlow = prepPhase >= 1;
  const jdGlow = prepPhase >= 2;
  const pipelineBusy = prepPhase === 3;
  const showInsights = prepPhase >= 4;
  const ctaEmphasis = prepPhase >= 5;
  const ctaGenerating = prepPhase >= 5;

  const barLine = (w: string, key: number) => (
    <div key={key} className={`h-1.5 rounded-sm bg-[var(--surface-container-high)] ${w}`} aria-hidden />
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden px-2 py-2 sm:gap-5 sm:px-3 sm:py-3 md:grid-cols-12 md:gap-6 md:px-4">
      <section className="flex min-h-0 max-h-[48%] flex-col overflow-hidden md:col-span-5 md:max-h-none">
        <div className="flex shrink-0 items-end justify-between border-b border-[var(--outline-variant)]/30 pb-2">
          <h2 className="font-headline text-sm font-medium tracking-tight text-[var(--on-surface)] md:text-base">
            {t("heroPrepStageAssets")}
          </h2>
          <span className="text-[8px] uppercase tracking-widest text-[var(--on-surface-variant)] md:text-[9px]">
            {t("heroPrepAnalysisVer")}
          </span>
        </div>

        <div className="mt-2 shrink-0 space-y-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <MaterialIcon name="description" className="!text-base shrink-0 text-[var(--primary)]" />
            <h3 className="font-headline text-sm text-[var(--on-surface)] md:text-base">{t("heroPrepResume")}</h3>
          </div>
          <div
            className={`space-y-1.5 rounded-xl bg-[var(--surface-container-low)] p-2.5 transition-[box-shadow] duration-300 md:p-3 ${
              resumeGlow ? "ring-1 ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]" : ""
            }`}
          >
            <p className="text-[8px] font-medium uppercase tracking-widest text-[var(--on-surface-variant)] md:text-[9px]">
              {t("heroPrepResumeHint")}
            </p>
            <div className="h-[4.25rem] rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] p-2 md:h-[4.75rem]">
              <div className="flex flex-col gap-1 pt-0.5">
                {[100, 94, 88, 100, 76].map((pct, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-sm bg-[var(--surface-container-high)]"
                    style={{ width: `${pct}%`, opacity: 0.45 + (i % 2) * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex min-h-[5rem] flex-1 flex-col gap-2 overflow-hidden md:min-h-0">
          <div className="flex shrink-0 items-center gap-1.5">
            <MaterialIcon name="article" className="!text-base shrink-0 text-[var(--primary)]" />
            <h3 className="font-headline text-sm text-[var(--on-surface)] md:text-base">{t("heroPrepJd")}</h3>
          </div>
          <div
            className={`flex min-h-0 flex-1 flex-col rounded-xl bg-[var(--surface-container-low)] p-2.5 transition-[box-shadow] duration-300 md:p-3 ${
              jdGlow ? "ring-1 ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]" : ""
            }`}
          >
            <p className="mb-1.5 shrink-0 text-[8px] font-medium uppercase tracking-widest text-[var(--on-surface-variant)] md:text-[9px]">
              {t("heroPrepJdLabel")}
            </p>
            <div className="min-h-0 flex-1 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] p-2">
              <div className="flex flex-col gap-1">
                {[100, 96, 100, 88, 92, 84, 100, 70].map((pct, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-sm bg-[var(--surface-container-high)]"
                    style={{ width: `${pct}%`, opacity: 0.4 + (i % 3) * 0.12 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 shrink-0 space-y-1">
          <p className="text-center text-[8px] leading-snug text-[var(--on-surface-variant)] md:text-[9px]">
            {pipelineBusy ? t("heroPrepPipelineBusy") : t("heroPrepMaterialsNote")}
          </p>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden md:col-span-7">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-0.5">
          {prepPhase < 3 ? (
            <div className="rounded-xl border border-dashed border-[var(--outline-variant)]/25 bg-[var(--surface-container-low)]/50 p-3 motion-safe:animate-[hero-mock-in_0.35s_ease-out] md:p-4">
              <div className="space-y-2" aria-hidden>
                {barLine("w-2/3", 0)}
                {barLine("w-full", 1)}
                {barLine("w-4/5", 2)}
                {barLine("w-[90%]", 3)}
              </div>
              <p className="mt-2 text-center text-[8px] text-[var(--on-surface-variant)] md:text-[9px]">
                …
              </p>
            </div>
          ) : null}

          {prepPhase === 3 ? (
            <div
              className="relative overflow-hidden rounded-xl bg-[var(--primary)]/90 p-4 text-[var(--on-primary)] motion-safe:animate-[hero-mock-in_0.4s_ease-out] md:p-5"
              aria-hidden
            >
              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.08)_50%,transparent_60%)] motion-safe:animate-pulse" />
              <div className="relative space-y-2">
                <div className="h-2 w-1/3 rounded-sm bg-[var(--on-primary)]/25" />
                <div className="h-2 w-full rounded-sm bg-[var(--on-primary)]/20" />
                <div className="h-2 w-[83%] rounded-sm bg-[var(--on-primary)]/20" />
              </div>
            </div>
          ) : null}

          {showInsights ? (
            <>
              <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl bg-[var(--primary)] p-4 text-[var(--on-primary)] shadow-[var(--shadow-card)] motion-safe:animate-[hero-mock-in_0.45s_ease-out] md:flex-row md:items-center md:justify-between md:p-5">
                <div className="relative z-10 min-w-0 max-w-full md:max-w-[62%]">
                  <h2 className="font-headline text-sm font-medium md:text-base">{t("heroPrepStrategicTitle")}</h2>
                  <div className="mt-2 space-y-1.5" aria-hidden>
                    <div className="h-1.5 w-full rounded-sm bg-[var(--on-primary)]/22" />
                    <div className="h-1.5 w-[92%] rounded-sm bg-[var(--on-primary)]/22" />
                    <div className="h-1.5 w-[78%] rounded-sm bg-[var(--on-primary)]/22" />
                    <div className="h-1.5 w-[88%] rounded-sm bg-[var(--on-primary)]/18" />
                  </div>
                  <div className="mt-2 h-1.5 w-12 rounded-sm bg-[var(--on-primary)]/30" aria-hidden />
                </div>
                <div className="relative z-10 flex flex-col items-center shrink-0">
                  <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full border-4 border-[var(--primary-container)]/40 md:h-16 md:w-16">
                    <span className="font-headline text-xl font-bold md:text-2xl">88</span>
                  </div>
                  <span className="mt-1 text-[8px] font-medium uppercase tracking-widest text-[var(--on-primary)]/70">
                    {t("heroPrepMatchScore")}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--surface-container)] p-3 md:p-4">
                <h2 className="font-headline mb-3 text-sm md:text-base">{t("heroPrepDistributionTitle")}</h2>
                <div className="space-y-3">
                  {[
                    { bar: 78, labelW: "w-24", tagW: "w-8" },
                    { bar: 64, labelW: "w-28", tagW: "w-9" },
                    { bar: 52, labelW: "w-20", tagW: "w-7" },
                  ].map((row, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between gap-2 text-[10px] md:text-xs">
                        <span className={`h-2 rounded-sm bg-[var(--surface-container-high)] ${row.labelW}`} aria-hidden />
                        <span className={`h-2 rounded-sm bg-[var(--surface-container-high)] ${row.tagW}`} aria-hidden />
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container-highest)]">
                        <div
                          className="h-full rounded-full bg-[var(--primary)]"
                          style={{ width: `${row.bar}%` }}
                        />
                      </div>
                      <div className="space-y-1 pt-0.5" aria-hidden>
                        <div className="h-1.5 w-full rounded-sm bg-[var(--surface-container-high)] opacity-50" />
                        <div className="h-1.5 w-[92%] rounded-sm bg-[var(--surface-container-high)] opacity-40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="shrink-0 space-y-1 border-t border-transparent pt-2">
          <p className="line-clamp-2 text-center text-[8px] leading-tight text-[var(--on-surface-variant)] md:text-[9px]">
            {t("heroPrepFooterHint")}
          </p>
          <button
            type="button"
            disabled
            className={`flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-[10px] font-medium transition md:min-h-10 md:gap-2 md:text-xs ${
              showInsights
                ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-lg"
                : "border border-[var(--outline-variant)]/30 bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)] shadow-none"
            } ${ctaEmphasis && !ctaGenerating ? "motion-safe:animate-pulse" : ""} ${ctaGenerating ? "opacity-95" : ""}`}
            aria-hidden
          >
            {ctaGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-flex h-4 items-end gap-0.5" aria-hidden>
                  <span
                    className="chat-bounce-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--on-primary)]/90"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="chat-bounce-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--on-primary)]/90"
                    style={{ animationDelay: "0.12s" }}
                  />
                  <span
                    className="chat-bounce-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--on-primary)]/90"
                    style={{ animationDelay: "0.24s" }}
                  />
                </span>
                <span>{t("heroPrepGenerating")}</span>
              </span>
            ) : (
              <>
                <span>{t("heroPrepConfirmCta")}</span>
                {showInsights ? (
                  <MaterialIcon name="auto_awesome" className="!text-base text-[var(--on-primary)]" />
                ) : null}
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

/** 与第一题真文案同宽：横条撑满气泡内容区，末行略短模拟段落最后一行 */
function QuestionRowSkeleton() {
  return (
    <div className="w-full min-w-0 py-0.5" aria-hidden>
      <div className="flex w-full min-w-0 flex-col gap-1.5">
        <div className="h-2 w-full min-w-0 shrink-0 rounded-sm bg-[var(--surface-container-high)]" />
        <div className="h-2 w-full min-w-0 shrink-0 rounded-sm bg-[var(--surface-container-high)]" />
        <div className="h-2 w-full min-w-0 max-w-[96%] shrink-0 rounded-sm bg-[var(--surface-container-high)]" />
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start motion-safe:animate-[hero-mock-in_0.25s_ease-out]">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none bg-[var(--surface-container-highest)] px-3 py-2.5">
        <span
          className="chat-bounce-dot h-1.5 w-1.5 rounded-full bg-[var(--on-surface-variant)]"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="chat-bounce-dot h-1.5 w-1.5 rounded-full bg-[var(--on-surface-variant)]"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="chat-bounce-dot h-1.5 w-1.5 rounded-full bg-[var(--on-surface-variant)]"
          style={{ animationDelay: "240ms" }}
        />
      </div>
    </div>
  );
}

function Q1DeliverableCard({ t }: { t: ReturnType<typeof useTranslations<"Landing">> }) {
  return (
    <div className="max-w-[96%] space-y-2.5 rounded-2xl rounded-tl-none border border-[var(--outline-variant)]/12 bg-[var(--surface-container-highest)] px-2.5 py-2.5 sm:max-w-[94%] sm:px-3 sm:py-3">
      <div className="space-y-1 border-b border-[var(--outline-variant)]/12 pb-2">
        <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--primary)] sm:text-[9px]">
          {t("heroMockBlockOutline")}
        </p>
        <p className="whitespace-pre-line text-[8px] leading-relaxed text-[var(--on-surface)] sm:text-[10px]">
          {t("heroMockOutlineBody")}
        </p>
      </div>
      <div className="space-y-1 border-b border-[var(--outline-variant)]/12 pb-2">
        <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--primary)] sm:text-[9px]">
          {t("heroMockBlockScript")}
        </p>
        <p className="font-headline text-[8px] leading-relaxed text-[var(--on-surface)] sm:text-[10px]">
          {t("heroMockScriptBody")}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--primary)] sm:text-[9px]">
          {t("heroMockBlockFollowups")}
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-[8px] leading-relaxed text-[var(--on-surface-variant)] sm:text-[10px]">
          <li>{t("heroMockFollowupLine1")}</li>
          <li>{t("heroMockFollowupLine2")}</li>
          <li>{t("heroMockFollowupLine3")}</li>
        </ul>
      </div>
    </div>
  );
}

function AiSkeletonDeliverable({ t }: { t: ReturnType<typeof useTranslations<"Landing">> }) {
  const bar = (w: string) => (
    <div
      className={`h-2 min-w-0 max-w-full rounded-sm bg-[var(--surface-container-high)] ${w}`}
      aria-hidden
    />
  );
  return (
    <div className="w-full max-w-[96%] space-y-2 rounded-2xl rounded-tl-none border border-[var(--outline-variant)]/12 bg-[var(--surface-container-highest)] px-2.5 py-2.5 sm:max-w-[94%]">
      <div className="w-full min-w-0 space-y-1.5">
        <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--primary)] sm:text-[9px]">
          {t("heroMockBlockOutline")}
        </p>
        {bar("w-full")}
        {bar("w-full")}
        {bar("w-[94%]")}
      </div>
      <div className="w-full min-w-0 space-y-1.5 border-t border-[var(--outline-variant)]/12 pt-2">
        <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--primary)] sm:text-[9px]">
          {t("heroMockBlockScript")}
        </p>
        {bar("w-full")}
        {bar("w-full")}
        {bar("w-full")}
        {bar("w-[91%]")}
      </div>
      <div className="w-full min-w-0 space-y-1.5 border-t border-[var(--outline-variant)]/12 pt-2">
        <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--primary)] sm:text-[9px]">
          {t("heroMockBlockFollowups")}
        </p>
        {bar("w-full")}
        {bar("w-full")}
        {bar("w-[88%]")}
      </div>
    </div>
  );
}

function ScriptCardIntroTitleOnly({
  title,
  newest,
  newestLabel,
  className,
}: {
  title: string;
  newest: boolean;
  newestLabel: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface-container-lowest)] p-2 shadow-sm sm:p-2.5 ${
        newest ? "ring-1 ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]" : ""
      } ${className ?? ""}`}
    >
      <div className="mb-1 flex items-start justify-between gap-1">
        <p className="font-headline text-[9px] font-semibold leading-tight text-[var(--on-surface)] sm:text-[10px]">
          {title}
        </p>
        {newest && (
          <span className="shrink-0 rounded bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-1 py-0.5 text-[6px] font-bold uppercase tracking-wider text-[var(--primary)] sm:text-[7px]">
            {newestLabel}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1" aria-hidden>
        {CARD_TAIL_WIDTHS.map((w, i) => (
          <div
            key={i}
            className="h-1.5 rounded-sm bg-[var(--surface-container-high)]"
            style={{ width: `${w}%`, opacity: 0.35 + (i % 3) * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}

function ScriptCardFullyPlaceholder({
  newest,
  newestLabel,
}: {
  newest: boolean;
  newestLabel: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface-container-lowest)] p-2 shadow-sm motion-safe:animate-[hero-mock-in_0.45s_ease-out] sm:p-2.5 ${
        newest ? "ring-1 ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="h-2.5 w-[72%] rounded bg-[var(--surface-container-high)]" aria-hidden />
        {newest && (
          <span className="shrink-0 rounded bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-1 py-0.5 text-[6px] font-bold uppercase tracking-wider text-[var(--primary)] sm:text-[7px]">
            {newestLabel}
          </span>
        )}
      </div>
      <div className="space-y-1.5" aria-hidden>
        <div className="h-2 w-full rounded bg-[var(--surface-container-high)]" />
        <div className="h-2 w-[90%] rounded bg-[var(--surface-container-high)]" />
        <div className="h-2 w-full rounded bg-[var(--surface-container-high)]" />
        <div className="h-2 w-[68%] rounded bg-[var(--surface-container-high)]" />
        <div className="h-2 w-[82%] rounded bg-[var(--surface-container-high)]" />
      </div>
    </div>
  );
}
