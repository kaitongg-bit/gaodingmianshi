"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DEMO_JD, DEMO_RESUME } from "@/lib/demo-copy";

type AnalysisResult = {
  overallFit: { label: string; score0to100: number; oneLiner: string };
  dimensions: { name: string; level: string; detail: string }[];
  prepNotes: {
    strengths: string;
    gaps: string;
    likelyQuestionThemes: string;
  };
};

type QuestionItem = { id: string; round: number; title: string };

type ChatTurn = { role: "user" | "assistant"; content: string };

export function Workbench() {
  const t = useTranslations("Workspace");
  const locale = useLocale();
  const messages = useMessages() as {
    Workspace?: { thinkingSteps?: string[] };
  };
  const thinkingSteps = messages.Workspace?.thinkingSteps ?? [];

  const [resume, setResume] = useState(DEMO_RESUME);
  const [jd, setJd] = useState(DEMO_JD);
  const [roundsCount, setRoundsCount] = useState(3);
  const [extraHint, setExtraHint] = useState("");
  const [activeTab, setActiveTab] = useState<"setup" | number>("setup");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatById, setChatById] = useState<Record<string, ChatTurn[]>>({});
  const [scriptById, setScriptById] = useState<Record<string, string>>({});
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const thinkTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const n = Math.max(1, thinkingSteps.length);
    if (loadingAnalyze) {
      setThinkingStep(0);
      thinkTimer.current = setInterval(() => {
        setThinkingStep((s) => (s + 1) % n);
      }, 900);
    } else if (thinkTimer.current) {
      clearInterval(thinkTimer.current);
      thinkTimer.current = null;
    }
    return () => {
      if (thinkTimer.current) clearInterval(thinkTimer.current);
    };
  }, [loadingAnalyze, thinkingSteps.length]);

  const filteredQuestions = useMemo(
    () =>
      activeTab === "setup"
        ? []
        : questions.filter((q) => q.round === activeTab),
    [questions, activeTab],
  );

  const selectedQ = useMemo(
    () => questions.find((q) => q.id === selectedId) ?? null,
    [questions, selectedId],
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
        data?: AnalysisResult;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        if (json.error === "missing_api_key") {
          setError(t("apiKeyMissing"));
        } else {
          setError(json.message ?? json.error ?? "error");
        }
        return;
      }
      if (json.data) setAnalysis(json.data);
    } catch {
      setError("network");
    } finally {
      setLoadingAnalyze(false);
    }
  }, [resume, jd, locale, t]);

  const runQuestions = useCallback(async () => {
    setError(null);
    setLoadingQuestions(true);
    try {
      const res = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          jd,
          locale,
          rounds: roundsCount,
          extraHint,
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
        if (json.error === "missing_api_key") {
          setError(t("apiKeyMissing"));
        } else {
          setError(json.message ?? json.error ?? "error");
        }
        return;
      }
      if (json.questions?.length) {
        setQuestions(json.questions);
        setActiveTab(1);
        const first = json.questions.find((q) => q.round === 1) ?? json.questions[0];
        setSelectedId(first.id);
      }
    } catch {
      setError("network");
    } finally {
      setLoadingQuestions(false);
    }
  }, [resume, jd, locale, roundsCount, extraHint, analysis, t]);

  const sendChat = useCallback(async () => {
    if (!selectedQ || !chatInput.trim()) return;
    setError(null);
    const userMsg = chatInput.trim();
    setChatInput("");
    const prev = chatById[selectedQ.id] ?? [];
    const nextMsgs = [...prev, { role: "user" as const, content: userMsg }];
    setChatById((m) => ({ ...m, [selectedQ.id]: nextMsgs }));
    setLoadingChat(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionTitle: selectedQ.title,
          messages: nextMsgs,
          locale,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        if (json.error === "missing_api_key") {
          setError(t("apiKeyMissing"));
        } else {
          setError(json.message ?? json.error ?? "error");
        }
        setChatById((m) => ({ ...m, [selectedQ.id]: prev }));
        return;
      }
      const reply = json.reply ?? "";
      const withAssistant = [...nextMsgs, { role: "assistant" as const, content: reply }];
      setChatById((m) => ({ ...m, [selectedQ.id]: withAssistant }));
      setScriptById((s) => ({
        ...s,
        [selectedQ.id]: `### ${selectedQ.title}\n\n${reply}\n`,
      }));
    } catch {
      setError("network");
      setChatById((m) => ({ ...m, [selectedQ.id]: prev }));
    } finally {
      setLoadingChat(false);
    }
  }, [selectedQ, chatInput, chatById, locale, t]);

  const exportMarkdown = useCallback(() => {
    const lines = questions.map((q, i) => {
      const body = scriptById[q.id]?.trim() || `_（未生成）_ ${q.title}`;
      return `## ${i + 1}. ${q.title}\n\n${body}\n`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `interview-script-${locale}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [questions, scriptById, locale]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-2 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--accent-muted)] px-2 py-0.5 text-[var(--accent)]">
            {t("mockBadge")}
          </span>
          <button type="button" className="whitespace-nowrap px-2 text-[var(--text-muted)]">
            {t("member")}
          </button>
          <button type="button" className="whitespace-nowrap px-2 text-[var(--text-muted)]">
            {t("share")}
          </button>
          <span className="whitespace-nowrap px-2 text-[var(--text-muted)]" title="面试前准备，非考场辅助">
            {t("compliance")}
          </span>
        </div>
        <Link href="/projects" className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)]">
          ←
        </Link>
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1">
        <button
          type="button"
          onClick={() => setActiveTab("setup")}
          className={`whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1 text-xs ${
            activeTab === "setup"
              ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {t("tabSetup")}
        </button>
        {Array.from({ length: roundsCount }, (_, i) => i + 1).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setActiveTab(r);
              const first = questions.find((q) => q.round === r);
              setSelectedId(first?.id ?? null);
            }}
            className={`whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1 text-xs ${
              activeTab === r
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {t("tabRound", { n: r })}
          </button>
        ))}
      </div>

      {error && (
        <div className="border-b border-[var(--border)] bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      )}

      {activeTab === "setup" ? (
        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-2">
          <div className="flex min-h-[50vh] flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r">
            <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-muted)]">
              {t("resume")}
            </div>
            <textarea
              className="min-h-0 flex-1 resize-none bg-[var(--surface)] p-3 text-sm leading-relaxed text-[var(--text)] outline-none"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
          </div>
          <div className="flex min-h-0 flex-col overflow-y-auto">
            <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-muted)]">
              {t("jd")}
            </div>
            <textarea
              className="min-h-32 resize-y bg-[var(--surface)] p-3 text-sm leading-relaxed text-[var(--text)] outline-none"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />

            <div className="space-y-3 border-t border-[var(--border)] p-3">
              <label className="block text-xs font-medium text-[var(--text-muted)]">
                {t("rounds")}
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={roundsCount}
                  onChange={(e) =>
                    setRoundsCount(
                      Math.min(5, Math.max(1, Number(e.target.value) || 1)),
                    )
                  }
                  className="ml-2 w-14 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--text-muted)]">
                {t("extraHint")}
                <input
                  value={extraHint}
                  onChange={(e) => setExtraHint(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-sm"
                />
              </label>

              {loadingAnalyze && thinkingSteps.length > 0 && (
                <p className="text-xs text-[var(--text-muted)]">
                  {thinkingSteps[thinkingStep % thinkingSteps.length]}
                </p>
              )}

              <button
                type="button"
                onClick={runAnalyze}
                disabled={loadingAnalyze}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] py-2 text-sm hover:bg-[var(--surface-muted)] disabled:opacity-50"
              >
                {loadingAnalyze ? t("analyzing") : t("analyze")}
              </button>

              {analysis && (
                <div className="space-y-3 text-sm">
                  <div className="surface-card p-3">
                    <h3 className="text-xs font-semibold text-[var(--text)]">
                      {t("matchTitle")}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {t("matchDisclaimer")}
                    </p>
                    <p className="mt-2 font-medium text-[var(--text)]">
                      {analysis.overallFit?.label} · {analysis.overallFit?.score0to100}/100
                    </p>
                    <p className="mt-1 text-[var(--text-muted)]">
                      {analysis.overallFit?.oneLiner}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--text)]">
                      {analysis.dimensions?.map((d) => (
                        <li key={d.name}>
                          <span className="font-medium">{d.name}</span>（{d.level}）—{" "}
                          {d.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="surface-card p-3">
                    <h3 className="text-xs font-semibold">{t("analysisTitle")}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--text-muted)]">
                      <strong className="text-[var(--text)]">亮点</strong>
                      <br />
                      {analysis.prepNotes?.strengths}
                      <br />
                      <br />
                      <strong className="text-[var(--text)]">缺口</strong>
                      <br />
                      {analysis.prepNotes?.gaps}
                      <br />
                      <br />
                      <strong className="text-[var(--text)]">可能题型</strong>
                      <br />
                      {analysis.prepNotes?.likelyQuestionThemes}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={runQuestions}
                    disabled={loadingQuestions}
                    className="w-full rounded-[var(--radius-sm)] bg-[var(--text)] py-2 text-sm text-[var(--surface)] hover:opacity-90 disabled:opacity-50"
                  >
                    {loadingQuestions ? t("analyzing") : t("generateQuestions")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-1 lg:grid-cols-[minmax(200px,280px)_1fr_minmax(240px,360px)]">
          <aside className="flex min-h-0 flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r">
            <div className="flex gap-1 border-b border-[var(--border)] p-2">
              <button
                type="button"
                className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text)]"
              >
                {t("screenshot")}
              </button>
              <button
                type="button"
                className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text)]"
              >
                {t("newQuestion")}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <p className="mb-2 text-[10px] font-medium uppercase text-[var(--text-muted)]">
                {t("questionsTitle")}
              </p>
              <ul className="space-y-1">
                {filteredQuestions.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(q.id)}
                      className={`w-full rounded-[var(--radius-sm)] border px-2 py-2 text-left text-xs ${
                        selectedId === q.id
                          ? "border-[var(--border-strong)] bg-[var(--surface-muted)]"
                          : "border-transparent hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {q.title}
                    </button>
                  </li>
                ))}
              </ul>
              {filteredQuestions.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">
                  {t("placeholderChat")}
                </p>
              )}
            </div>
          </aside>

          <section className="flex min-h-[40vh] min-w-0 flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r">
            <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-muted)]">
              {t("chatTitle")}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
              {!selectedQ && (
                <p className="text-[var(--text-muted)]">{t("selectQuestion")}</p>
              )}
              {selectedQ &&
                (chatById[selectedQ.id] ?? []).map((m, i) => (
                  <div
                    key={`${selectedQ.id}-${i}`}
                    className={`rounded-[var(--radius-sm)] border px-3 py-2 text-xs ${
                      m.role === "user"
                        ? "ml-4 border-[var(--border)] bg-[var(--surface-muted)]"
                        : "mr-4 border-[var(--border)] bg-[var(--surface)]"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
              {loadingChat && (
                <p className="text-xs text-[var(--text-muted)]">…</p>
              )}
            </div>
            <div className="flex gap-2 border-t border-[var(--border)] p-2">
              <input
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1.5 text-sm"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
                placeholder={t("placeholderChat")}
                disabled={!selectedQ || loadingChat}
              />
              <button
                type="button"
                onClick={() => void sendChat()}
                disabled={!selectedQ || loadingChat || !chatInput.trim()}
                className="rounded-[var(--radius-sm)] bg-[var(--text)] px-3 py-1.5 text-xs text-[var(--surface)] disabled:opacity-40"
              >
                OK
              </button>
            </div>
          </section>

          <aside className="flex min-h-[30vh] flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {t("scriptTitle")}
              </span>
              <button
                type="button"
                onClick={exportMarkdown}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {t("exportMd")}
              </button>
            </div>
            <textarea
              className="min-h-0 flex-1 resize-none bg-[var(--surface)] p-3 text-xs leading-relaxed text-[var(--text)] outline-none"
              readOnly
              value={questions
                .map((q) => scriptById[q.id] || "")
                .filter(Boolean)
                .join("\n\n---\n\n")}
              placeholder={t("placeholderScript")}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
