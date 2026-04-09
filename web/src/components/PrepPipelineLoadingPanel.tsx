"use client";

type Props = {
  /** 已等待毫秒（用于平滑进度条） */
  elapsedMs: number;
  stepLines: string[];
  /** 预计总时长（秒），用于估算进度与阶段切换 */
  typicalSeconds: number;
  headline: string;
  /** 例如 "已等待" / "Elapsed" */
  elapsedPrefix: string;
  typicalNote: string;
};

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PrepPipelineLoadingPanel({
  elapsedMs,
  stepLines,
  typicalSeconds,
  headline,
  elapsedPrefix,
  typicalNote,
}: Props) {
  const elapsedSec = elapsedMs / 1000;
  const displaySec = Math.floor(elapsedSec);
  const n = Math.max(1, stepLines.length);
  const cap = Math.max(30, typicalSeconds);
  const stepIdx = Math.min(n - 1, Math.floor((elapsedSec / cap) * n));
  const currentLine =
    stepLines[stepIdx] ?? stepLines[stepLines.length - 1] ?? "…";
  const barPct = Math.min(94, 4 + (elapsedSec / cap) * 90);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="rounded-2xl border border-[var(--outline-variant)]/25 bg-[var(--surface-container-lowest)] p-4 shadow-[var(--shadow-card)] md:p-5"
    >
      <div className="flex gap-4">
        <div className="prep-pipeline-spinner shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-headline text-lg font-medium text-[var(--on-surface)] md:text-xl">
            {headline}
          </p>
          <p className="text-sm leading-relaxed text-[var(--on-surface-variant)]">{currentLine}</p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-[var(--on-surface-variant)]">
            <span className="tabular-nums text-[var(--on-surface)]">
              {elapsedPrefix}{" "}
              <span className="font-medium">{formatMmSs(displaySec)}</span>
            </span>
            <span className="text-[var(--on-surface-variant)]/90">{typicalNote}</span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="prep-pipeline-track" aria-hidden>
          <div className="prep-pipeline-fill" style={{ width: `${barPct}%` }} />
        </div>
        <div className="mt-3 flex gap-1 sm:gap-1.5" aria-hidden>
          {Array.from({ length: n }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 min-w-0 flex-1 rounded-full transition-[background-color,transform] duration-500 ease-out ${
                i < stepIdx
                  ? "bg-[var(--primary)]"
                  : i === stepIdx
                    ? "bg-[var(--primary)]/85 prep-pipeline-step-pulse"
                    : "bg-[var(--surface-container-highest)]"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
