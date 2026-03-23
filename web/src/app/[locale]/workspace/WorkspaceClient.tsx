"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { DraftNav } from "@/components/DraftNav";
import { MarkdownBody } from "@/components/MarkdownBody";
import { MaterialIcon } from "@/components/MaterialIcon";
import type {
  AnalysisPayload,
  WorkspaceChatTurn,
  WorkspaceQuestion,
  WorkspaceSession,
} from "@/lib/client-session";
import { PENDING_ROUND_SESSION_KEY } from "@/lib/projects-storage";
import { cleanScriptContent } from "@/lib/script-clean";
import { serializeScriptsToTranscript } from "@/lib/transcript-scripts";

type ChatTurn = WorkspaceChatTurn;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapChatError(
  err: string | undefined,
  t: ReturnType<typeof useTranslations<"Workspace">>,
): string {
  if (err === "missing_api_key") return t("apiKeyMissing");
  if (err === "insufficient_credits") return t("insufficientCredits");
  if (err === "unauthorized") return t("loginRequired");
  return err ?? "error";
}

export function WorkspaceClient() {
  const t = useTranslations("Workspace");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectQuery = searchParams.get("project") ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [questions, setQuestions] = useState<WorkspaceQuestion[]>([]);
  const [activeRound, setActiveRound] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatById, setChatById] = useState<Record<string, ChatTurn[]>>({});
  const [scriptById, setScriptById] = useState<Record<string, string>>({});
  const [chatInput, setChatInput] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftAttachment, setDraftAttachment] = useState<{
    dataUrl: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [addingDraft, setAddingDraft] = useState(false);
  const [newSessionBusy, setNewSessionBusy] = useState(false);

  const onRoundSelect = useCallback(
    (r: number) => {
      setActiveRound(r);
      const first = questions.find((q) => q.round === r);
      setSelectedId(first?.id ?? null);
    },
    [questions],
  );

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
    if (!projectQuery || !UUID_RE.test(projectQuery)) {
      router.replace("/projects");
      return;
    }
    let cancelled = false;
    setCloudReady(false);
    setSession(null);

    void (async () => {
      const r = await fetch(`/api/projects/${projectQuery}/workspace`);
      const j = (await r.json()) as {
        project?: {
          id: string;
          resume_text: string;
          jd_text: string;
          rounds_count: number;
          active_round: number;
          analysis_jsonb: unknown;
        };
        questions?: WorkspaceQuestion[];
        chatById?: Record<string, ChatTurn[]>;
        scriptById?: Record<string, string>;
        error?: string;
      };

      if (cancelled) return;
      if (!r.ok || !j.project) {
        router.replace("/prep");
        return;
      }

      const qs = j.questions ?? [];
      if (qs.length === 0) {
        router.replace(`/prep?project=${projectQuery}`);
        return;
      }

      const ws: WorkspaceSession = {
        projectId: j.project.id,
        resume: j.project.resume_text,
        jd: j.project.jd_text,
        roundsCount: j.project.rounds_count,
        analysis: (j.project.analysis_jsonb ?? null) as AnalysisPayload | null,
        questions: qs,
        chatById: j.chatById ?? {},
        scriptById: j.scriptById ?? {},
      };

      setSession(ws);
      setQuestions(qs.map((q) => ({ ...q })));
      setChatById(j.chatById ?? {});
      setScriptById(j.scriptById ?? {});

      const pendingRaw = sessionStorage.getItem(PENDING_ROUND_SESSION_KEY);
      if (pendingRaw) {
        const rN = Number.parseInt(pendingRaw, 10);
        sessionStorage.removeItem(PENDING_ROUND_SESSION_KEY);
        const round =
          Number.isFinite(rN) && rN >= 1 && rN <= ws.roundsCount ? rN : 1;
        setActiveRound(round);
        const pick = qs.find((q) => q.round === round) ?? qs[0];
        setSelectedId(pick?.id ?? null);
      } else {
        const ar = Math.min(
          ws.roundsCount,
          Math.max(1, Number(j.project.active_round) || 1),
        );
        setActiveRound(ar);
        const pick = qs.find((q) => q.round === ar) ?? qs[0];
        setSelectedId(pick?.id ?? null);
      }

      setCloudReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectQuery, router]);

  useEffect(() => {
    if (!cloudReady || !projectQuery) return;
    const tid = window.setTimeout(() => {
      void fetch(`/api/projects/${projectQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript_text: serializeScriptsToTranscript(scriptById),
          active_round: activeRound,
        }),
      });
    }, 450);
    return () => window.clearTimeout(tid);
  }, [scriptById, activeRound, projectQuery, cloudReady]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatById, selectedId, loadingChat]);

  const filteredQuestions = useMemo(
    () => questions.filter((q) => q.round === activeRound),
    [questions, activeRound],
  );

  const selectedQ = useMemo(
    () => questions.find((q) => q.id === selectedId) ?? null,
    [questions, selectedId],
  );

  const lastAssistantContent = useMemo(() => {
    if (!selectedQ) return null;
    const msgs = chatById[selectedQ.id] ?? [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") return msgs[i].content;
    }
    return null;
  }, [selectedQ, chatById]);

  const roundsCount = session?.roundsCount ?? 3;

  const importToScript = useCallback(
    (raw: string, q: WorkspaceQuestion) => {
      const cleaned = cleanScriptContent(raw, q.title);
      if (!cleaned) return;
      setScriptById((s) => ({ ...s, [q.id]: cleaned }));
      setError(null);
    },
    [],
  );

  const importFullReply = useCallback(() => {
    if (!selectedQ || !lastAssistantContent) {
      setError(t("importNoAssistant"));
      return;
    }
    importToScript(lastAssistantContent, selectedQ);
  }, [selectedQ, lastAssistantContent, importToScript, t]);

  const importSelection = useCallback(() => {
    if (!selectedQ) return;
    const sel = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
    if (!sel) {
      setError(t("importNeedSelection"));
      return;
    }
    importToScript(sel, selectedQ);
  }, [selectedQ, importToScript, t]);

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
          jd: session?.jd ?? "",
          resume: session?.resume ?? "",
          round: selectedQ.round,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(mapChatError(json.error ?? json.message, t));
        setChatById((m) => ({ ...m, [selectedQ.id]: prev }));
        return;
      }
      const reply = json.reply ?? "";

      const u = await fetch(`/api/questions/${selectedQ.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: userMsg }),
      });
      if (!u.ok) {
        setChatById((m) => ({ ...m, [selectedQ.id]: prev }));
        setError("save_failed");
        return;
      }
      const a = await fetch(`/api/questions/${selectedQ.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "assistant", content: reply }),
      });
      if (!a.ok) {
        setChatById((m) => ({ ...m, [selectedQ.id]: prev }));
        setError("save_failed");
        return;
      }

      const withAssistant = [...nextMsgs, { role: "assistant" as const, content: reply }];
      setChatById((m) => ({ ...m, [selectedQ.id]: withAssistant }));
    } catch {
      setError("network");
      setChatById((m) => ({ ...m, [selectedQ.id]: prev }));
    } finally {
      setLoadingChat(false);
    }
  }, [selectedQ, chatInput, chatById, locale, session, t]);

  const exportMarkdown = useCallback(() => {
    const pending = t("scriptPending");
    const lines = questions.map((q, i) => {
      const body = scriptById[q.id]?.trim() || `${pending} ${q.title}`;
      return `## ${i + 1}. ${q.title}\n\n${body}\n`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `interview-script-${locale}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [questions, scriptById, locale, t]);

  const addDraftQuestion = useCallback(async () => {
    const text = draftText.trim();
    if (!text && !draftAttachment) return;
    if (!projectQuery) return;
    setAddingDraft(true);
    setError(null);
    const title =
      text || t("questionFromAttachment", { name: draftAttachment?.name ?? "file" });
    const attachment_url =
      draftAttachment && draftAttachment.dataUrl.length < 12_000
        ? draftAttachment.dataUrl
        : null;
    try {
      const res = await fetch(`/api/projects/${projectQuery}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          round: activeRound,
          source: "user",
          attachment_url,
        }),
      });
      const j = (await res.json()) as {
        question?: { id: string; round: number; title: string; imagePreview?: string };
        error?: string;
      };
      if (!res.ok || !j.question) {
        setError(j.error ?? "add_failed");
        return;
      }
      const q = j.question;
      setQuestions((prev) => [
        ...prev,
        {
          id: q.id,
          round: q.round,
          title: q.title,
          imagePreview: q.imagePreview,
        },
      ]);
      setSelectedId(q.id);
      setDraftText("");
      setDraftAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("network");
    } finally {
      setAddingDraft(false);
    }
  }, [draftText, draftAttachment, activeRound, projectQuery, t]);

  const onDraftFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type.startsWith("image/")) {
        if (file.size > MAX_IMAGE_BYTES) {
          setError(t("fileTooLarge"));
          e.target.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = typeof reader.result === "string" ? reader.result : "";
          if (dataUrl) setDraftAttachment({ dataUrl, name: file.name });
        };
        reader.readAsDataURL(file);
        return;
      }
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        const reader = new FileReader();
        reader.onload = () => {
          const txt = typeof reader.result === "string" ? reader.result : "";
          setDraftText((prev) => (prev ? `${prev}\n\n${txt}` : txt));
        };
        reader.readAsText(file);
        e.target.value = "";
        return;
      }
      setError(t("fileTypeUnsupported"));
      e.target.value = "";
    },
    [t],
  );

  const pasteLink = useCallback(() => {
    const url = typeof window !== "undefined" ? window.prompt(t("linkPrompt")) : null;
    if (!url?.trim()) return;
    setDraftText((prev) => (prev ? `${prev}\n\n${url.trim()}` : url.trim()));
  }, [t]);

  const scriptedBlocks = useMemo(() => {
    return questions
      .map((q) => ({ q, body: scriptById[q.id]?.trim() ?? "" }))
      .filter((x) => x.body.length > 0);
  }, [questions, scriptById]);

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-sm text-[var(--on-surface-variant)]">
        …
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--background)]">
      <DraftNav
        variant="app"
        activeStep={activeRound}
        roundsCount={roundsCount}
        onRoundSelect={onRoundSelect}
        prepProjectId={projectQuery}
        onNewSession={handleNewSession}
        newSessionBusy={newSessionBusy}
      />

      <div className="flex min-h-0 flex-1 flex-col pt-14 md:pt-16">
        {error && (
          <div className="shrink-0 border-b border-amber-200/50 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 md:px-8">
            {error}
          </div>
        )}

        <p className="shrink-0 px-4 py-1 text-center text-[10px] text-[var(--on-surface-variant)] md:px-8">
          {t("complianceLine")}
        </p>

        <main
          id="main"
          className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-0 overflow-hidden px-4 pb-3 md:flex-row md:px-8 md:pb-4"
        >
          <section className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[var(--surface-container-low)] p-4 md:p-6 lg:flex-[0_0_26%]">
            <div className="shrink-0">
              <h2 className="font-headline mb-4 text-xl font-medium text-[var(--on-surface)] md:text-2xl">
                {t("questionList")}
              </h2>
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                {t("draftQuestion")}
              </label>
              <div className="group relative mt-2">
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder={t("draftPlaceholder")}
                  rows={4}
                  className="relative z-[1] min-h-[6.5rem] w-full resize-none rounded-lg border-0 bg-[var(--surface-container-lowest)] p-4 pb-12 text-sm text-[var(--on-surface)] ring-1 ring-transparent placeholder:text-[var(--outline-variant)] focus:outline-none focus:ring-[var(--primary)]"
                />
                <div
                  className="pointer-events-none absolute inset-0 z-0 rounded-lg border-2 border-dashed border-[var(--outline-variant)]/30 group-focus-within:opacity-0"
                  aria-hidden
                />
                <div className="absolute bottom-3 right-3 z-[2] flex gap-2">
                  <button
                    type="button"
                    title={t("uploadTitle")}
                    onClick={() => fileInputRef.current?.click()}
                    className="pointer-events-auto rounded-md bg-[var(--surface-container-low)] p-1.5 text-[var(--on-surface-variant)] transition hover:text-[var(--primary)]"
                  >
                    <MaterialIcon name="upload_file" className="!text-base" />
                  </button>
                  <button
                    type="button"
                    title={t("linkTitle")}
                    onClick={pasteLink}
                    className="pointer-events-auto rounded-md bg-[var(--surface-container-low)] p-1.5 text-[var(--on-surface-variant)] transition hover:text-[var(--primary)]"
                  >
                    <MaterialIcon name="link" className="!text-base" />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.txt,text/plain"
                  className="hidden"
                  onChange={onDraftFile}
                />
              </div>
              {draftAttachment && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface-container-lowest)] p-2">
                  <Image
                    src={draftAttachment.dataUrl}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 rounded object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--on-surface-variant)]">
                    {draftAttachment.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftAttachment(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-[var(--primary)]"
                  >
                    {t("removeAttachment")}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => void addDraftQuestion()}
                disabled={(!draftText.trim() && !draftAttachment) || addingDraft}
                className="mt-3 w-full rounded-lg bg-[var(--primary)] py-2.5 text-sm font-medium text-[var(--on-primary)] shadow-sm transition hover:opacity-95 active:scale-[0.99] disabled:opacity-40"
              >
                {t("addToList")}
              </button>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <h3 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                {t("generated")}
              </h3>
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">
                <ul className="flex flex-col gap-2 pb-2">
                  {filteredQuestions.map((q) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(q.id)}
                        className={`flex w-full gap-3 rounded-lg p-3 text-left transition ${
                          selectedId === q.id
                            ? "border-l-4 border-[var(--primary)] bg-[var(--surface-container-lowest)] shadow-sm"
                            : "bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)]"
                        }`}
                      >
                        {q.imagePreview ? (
                          <Image
                            src={q.imagePreview}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                            className="h-10 w-10 shrink-0 rounded object-cover"
                          />
                        ) : null}
                        <span className="line-clamp-4 whitespace-pre-wrap text-sm leading-snug text-[var(--on-surface)]">
                          {q.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {filteredQuestions.length === 0 && (
                  <p className="py-4 text-sm text-[var(--on-surface-variant)]">{t("emptyRound")}</p>
                )}
              </div>
            </div>
          </section>

          <section className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-[var(--outline-variant)]/10 bg-[var(--surface)] md:mt-0 md:border-x md:px-2">
            <div className="flex min-h-0 flex-1 flex-col px-3 py-4 md:px-4">
              <header className="mb-3 shrink-0">
                <h2 className="font-headline text-xl font-medium text-[var(--on-surface)] md:text-2xl">
                  {t("iterateTitle")}
                </h2>
                {selectedQ ? (
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    {t("refining")}{" "}
                    <span className="text-[var(--primary)] italic">
                      {selectedQ.title.length > 90 ? `${selectedQ.title.slice(0, 90)}…` : selectedQ.title}
                    </span>
                    {loadingChat ? (
                      <span className="ml-2 text-xs text-[var(--on-surface-variant)]">…</span>
                    ) : null}
                  </p>
                ) : null}
              </header>

              <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {!selectedQ && (
                  <p className="text-sm text-[var(--on-surface-variant)]">{t("selectQuestion")}</p>
                )}
                {selectedQ &&
                  (chatById[selectedQ.id] ?? []).map((m, i) => (
                    <div
                      key={`${selectedQ.id}-${i}`}
                      className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm ${
                        m.role === "user"
                          ? "ml-auto bg-[var(--primary)]/15 text-[var(--on-surface)]"
                          : "mr-auto border border-[var(--outline-variant)]/20 bg-[var(--surface-container-low)] text-[var(--on-surface)]"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <MarkdownBody content={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      )}
                    </div>
                  ))}
                <div ref={chatEndRef} className="h-1 shrink-0" aria-hidden />
              </div>

              <div className="mt-2 shrink-0 space-y-2 border-t border-[var(--outline-variant)]/10 pt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={importFullReply}
                    disabled={!selectedQ || !lastAssistantContent}
                    className="rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--surface-container-low)] disabled:opacity-40"
                  >
                    {t("importFullClean")}
                  </button>
                  <button
                    type="button"
                    onClick={importSelection}
                    disabled={!selectedQ}
                    className="rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-medium text-[var(--on-surface)] transition hover:bg-[var(--surface-container-low)] disabled:opacity-40"
                  >
                    {t("importSelection")}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--primary)]/25"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendChat();
                      }
                    }}
                    placeholder={t("chatPlaceholder")}
                    disabled={!selectedQ || loadingChat}
                  />
                  <button
                    type="button"
                    onClick={() => void sendChat()}
                    disabled={!selectedQ || loadingChat || !chatInput.trim()}
                    className="shrink-0 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--on-primary)] disabled:opacity-40"
                  >
                    {t("send")}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="mt-2 flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--surface-container-low)] p-4 md:mt-0 md:p-6 lg:flex-[0_0_32%]">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <h2 className="font-headline text-xl font-medium text-[var(--on-surface)] md:text-2xl">
                {t("transcriptTitle")}
              </h2>
              <button
                type="button"
                onClick={exportMarkdown}
                className="shrink-0 text-xs font-medium text-[var(--primary)] hover:underline"
              >
                {t("exportMd")}
              </button>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--outline-variant)]/10 bg-[var(--surface-container-lowest)] p-4">
              {scriptedBlocks.length === 0 ? (
                <p className="text-xs leading-relaxed text-[var(--on-surface-variant)]">
                  {t("placeholderScript")}
                </p>
              ) : (
                <div className="space-y-6">
                  {scriptedBlocks.map(({ q, body }) => (
                    <article
                      key={q.id}
                      className="border-b border-[var(--outline-variant)]/15 pb-5 last:border-b-0 last:pb-0"
                    >
                      <h3 className="font-headline mb-2 text-sm font-semibold leading-snug text-[var(--on-surface)]">
                        {q.title}
                      </h3>
                      <MarkdownBody content={body} className="text-xs md:text-sm" />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
