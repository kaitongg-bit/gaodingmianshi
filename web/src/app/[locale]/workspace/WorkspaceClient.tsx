"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AutoGrowTextarea } from "@/components/AutoGrowTextarea";
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
  const draftFileInputRef = useRef<HTMLInputElement>(null);
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
  const [addRoundBusy, setAddRoundBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRound, setEditRound] = useState(1);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  /** false = 本题逐字稿区块收起；缺省为展开 */
  const [scriptSectionExpanded, setScriptSectionExpanded] = useState<Record<string, boolean>>({});
  const [transcriptPanelOpen, setTranscriptPanelOpen] = useState(true);
  const [addQuestionModalOpen, setAddQuestionModalOpen] = useState(false);

  const reloadQuestionsOnly = useCallback(async () => {
    if (!projectQuery || !UUID_RE.test(projectQuery)) return;
    const r = await fetch(`/api/projects/${projectQuery}/workspace`);
    const j = (await r.json()) as {
      project?: { resume_text: string; jd_text: string; rounds_count: number; analysis_jsonb: unknown };
      questions?: WorkspaceQuestion[];
      error?: string;
    };
    if (!r.ok || !j.questions?.length) return;
    const qs = j.questions.map((q) => ({ ...q }));
    setQuestions(qs);
    setSession((prev) =>
      prev && j.project
        ? {
            ...prev,
            resume: j.project.resume_text,
            jd: j.project.jd_text,
            roundsCount: j.project.rounds_count,
            analysis: (j.project.analysis_jsonb ?? null) as AnalysisPayload | null,
            questions: qs,
          }
        : prev,
    );
  }, [projectQuery]);

  const onRoundSelect = useCallback(
    (r: number) => {
      setActiveRound(r);
      const first = questions.find((q) => q.round === r);
      setSelectedId(first?.id ?? null);
    },
    [questions],
  );

  const handleAddRound = useCallback(async () => {
    if (!projectQuery || !session) return;
    if (session.roundsCount >= 5) return;
    const next = session.roundsCount + 1;
    setAddRoundBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rounds_count: next,
          active_round: next,
          transcript_text: serializeScriptsToTranscript(scriptById),
        }),
      });
      if (!res.ok) {
        setError(t("addRoundFailed"));
        return;
      }
      setSession((s) => (s ? { ...s, roundsCount: next } : null));
      setActiveRound(next);
      setSelectedId(null);
    } catch {
      setError("network");
    } finally {
      setAddRoundBusy(false);
    }
  }, [projectQuery, session, scriptById, t]);

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

  useEffect(() => {
    if (!selectedId) return;
    setScriptSectionExpanded((s) => {
      if (s[selectedId] === false) {
        const next = { ...s };
        delete next[selectedId];
        return next;
      }
      return s;
    });
    setTranscriptPanelOpen(true);
  }, [selectedId]);

  const filteredQuestions = useMemo(
    () => questions.filter((q) => q.round === activeRound),
    [questions, activeRound],
  );

  const openEdit = useCallback((q: WorkspaceQuestion) => {
    setEditingId(q.id);
    setEditTitle(q.title);
    setEditRound(q.round);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
    setEditRound(1);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !projectQuery) return;
    const title = editTitle.trim();
    if (!title) {
      setError(t("titleRequired"));
      return;
    }
    setRowBusy(editingId);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectQuery}/questions/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, round: editRound }),
      });
      const j = (await res.json()) as { question?: WorkspaceQuestion; error?: string };
      if (!res.ok) {
        setError(j.error ?? "save_failed");
        return;
      }
      if (j.question) {
        setQuestions((prev) =>
          prev.map((x) =>
            x.id === j.question!.id
              ? {
                  ...x,
                  title: j.question!.title,
                  round: j.question!.round,
                  source: j.question!.source ?? x.source,
                  imagePreview: j.question!.imagePreview ?? x.imagePreview,
                }
              : x,
          ),
        );
        if (j.question.round !== activeRound && selectedId === j.question.id) {
          setActiveRound(j.question.round);
        }
      }
      cancelEdit();
    } catch {
      setError("network");
    } finally {
      setRowBusy(null);
    }
  }, [
    editingId,
    projectQuery,
    editTitle,
    editRound,
    activeRound,
    selectedId,
    cancelEdit,
    t,
  ]);

  const deleteQuestion = useCallback(
    async (q: WorkspaceQuestion) => {
      if (!projectQuery) return;
      if (typeof window !== "undefined" && !window.confirm(t("deleteQuestionConfirm"))) return;
      setRowBusy(q.id);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectQuery}/questions/${q.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          setError(j.error ?? "delete_failed");
          return;
        }
        const remaining = questions.filter((x) => x.id !== q.id);
        setQuestions(remaining);
        setChatById((c) => {
          const next = { ...c };
          delete next[q.id];
          return next;
        });
        setScriptById((s) => {
          const next = { ...s };
          delete next[q.id];
          return next;
        });
        if (editingId === q.id) cancelEdit();
        if (selectedId === q.id) {
          const sameRound = remaining.filter((x) => x.round === activeRound);
          const pick = sameRound[0] ?? remaining[0] ?? null;
          setSelectedId(pick?.id ?? null);
        }
        if (remaining.length === 0) {
          router.replace(`/prep?project=${projectQuery}`);
        }
      } catch {
        setError("network");
      } finally {
        setRowBusy(null);
      }
    },
    [
      projectQuery,
      questions,
      activeRound,
      selectedId,
      editingId,
      cancelEdit,
      router,
      t,
    ],
  );

  const moveQuestion = useCallback(
    async (q: WorkspaceQuestion, dir: "up" | "down") => {
      if (!projectQuery) return;
      setRowBusy(q.id);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectQuery}/questions/${q.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ move: dir }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          setError(j.error ?? "move_failed");
          return;
        }
        await reloadQuestionsOnly();
      } catch {
        setError("network");
      } finally {
        setRowBusy(null);
      }
    },
    [projectQuery, reloadQuestionsOnly],
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

  const closeAddQuestionModal = useCallback(() => {
    setAddQuestionModalOpen(false);
    setDraftText("");
    setDraftAttachment(null);
    if (draftFileInputRef.current) draftFileInputRef.current.value = "";
  }, []);

  const onModalPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it?.kind === "file" && it.type.startsWith("image/")) {
          e.preventDefault();
          const f = it.getAsFile();
          if (!f) break;
          if (f.size > MAX_IMAGE_BYTES) {
            setError(t("fileTooLarge"));
            break;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = typeof reader.result === "string" ? reader.result : "";
            if (dataUrl) {
              setDraftAttachment({ dataUrl, name: f.name || "clipboard.png" });
              setError(null);
            }
          };
          reader.readAsDataURL(f);
          break;
        }
      }
    },
    [t],
  );

  useEffect(() => {
    if (!addQuestionModalOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [addQuestionModalOpen]);

  useEffect(() => {
    if (!addQuestionModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAddQuestionModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addQuestionModalOpen, closeAddQuestionModal]);

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
          source: "user" as const,
          imagePreview: q.imagePreview,
        },
      ]);
      setSelectedId(q.id);
      closeAddQuestionModal();
    } catch {
      setError("network");
    } finally {
      setAddingDraft(false);
    }
  }, [draftText, draftAttachment, activeRound, projectQuery, t, closeAddQuestionModal]);

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

  const transcriptSections = useMemo(
    () => questions.map((q) => ({ q, body: scriptById[q.id] ?? "" })),
    [questions, scriptById],
  );

  /** 当前选中题置顶；右栏与左、中共用视口高度，仅各栏各一层纵向滚动 */
  const orderedTranscriptSections = useMemo(() => {
    if (!selectedId) return transcriptSections;
    const idx = transcriptSections.findIndex((x) => x.q.id === selectedId);
    if (idx <= 0) return transcriptSections;
    const chosen = transcriptSections[idx];
    const rest = transcriptSections.filter((_, i) => i !== idx);
    return [chosen, ...rest];
  }, [transcriptSections, selectedId]);

  const toggleScriptSection = useCallback((qid: string) => {
    setScriptSectionExpanded((s) => {
      const collapsed = s[qid] === false;
      if (collapsed) {
        const next = { ...s };
        delete next[qid];
        return next;
      }
      return { ...s, [qid]: false };
    });
  }, []);

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-sm text-[var(--on-surface-variant)]">
        …
      </div>
    );
  }

  return (
    <>
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--background)]">
      <DraftNav
        variant="app"
        activeStep={activeRound}
        roundsCount={roundsCount}
        onRoundSelect={onRoundSelect}
        prepProjectId={projectQuery}
        onAddRound={handleAddRound}
        addRoundBusy={addRoundBusy}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-14 md:pt-16">
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
          className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-0 overflow-y-auto px-4 pb-3 md:flex-row md:overflow-hidden md:px-8 md:pb-4"
        >
          <section className="flex w-full shrink-0 flex-col border-b border-[var(--outline-variant)]/10 bg-[var(--surface-container-low)] p-4 md:min-h-0 md:w-[min(22rem,100%)] md:max-w-sm md:shrink-0 md:flex-col md:overflow-hidden md:border-b-0 md:border-r md:p-6">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <h2 className="font-headline text-xl font-medium text-[var(--on-surface)] md:text-2xl">
                {t("questionList")}
              </h2>
              <button
                type="button"
                onClick={() => setAddQuestionModalOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] shadow-sm transition hover:opacity-95"
                title={t("addQuestionShort")}
                aria-label={t("addQuestionShort")}
              >
                <MaterialIcon name="add" className="!text-2xl" />
              </button>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden md:min-h-0 md:flex-1">
              <h3 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                {t("generated")}
              </h3>
              <div className="min-h-0 pr-1 md:flex-1 md:overflow-y-auto md:scrollbar-thin">
                <ul className="flex flex-col gap-2 pb-2">
                  {filteredQuestions.map((q, idx) => {
                    const busy = rowBusy === q.id;
                    const canUp = idx > 0;
                    const canDown = idx < filteredQuestions.length - 1;
                    return (
                      <li
                        key={q.id}
                        className={`overflow-hidden rounded-lg border border-transparent transition ${
                          selectedId === q.id
                            ? "border-[var(--primary)]/35 bg-[var(--surface-container-lowest)] shadow-sm"
                            : "bg-[var(--surface-container)]"
                        }`}
                      >
                        {editingId === q.id ? (
                          <div className="space-y-2 p-3">
                            <AutoGrowTextarea
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="min-h-24 w-full resize-none rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] p-2 text-sm text-[var(--on-surface)] outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                            />
                            <label className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
                              <span className="shrink-0 font-medium">{t("editRoundLabel")}</span>
                              <select
                                value={editRound}
                                onChange={(e) => setEditRound(Number(e.target.value))}
                                className="rounded border border-[var(--outline-variant)]/40 bg-[var(--surface-container-lowest)] px-2 py-1 text-[var(--on-surface)]"
                              >
                                {Array.from({ length: roundsCount }, (_, i) => i + 1).map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void saveEdit()}
                                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--on-primary)] disabled:opacity-40"
                              >
                                {t("saveQuestion")}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={cancelEdit}
                                className="rounded-lg border border-[var(--outline-variant)]/40 px-3 py-1.5 text-xs text-[var(--on-surface)]"
                              >
                                {t("cancelEdit")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedId(q.id)}
                              className={`flex w-full gap-3 p-3 text-left transition hover:bg-[var(--surface-container-high)]/60 ${
                                selectedId === q.id ? "" : ""
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
                              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-snug text-[var(--on-surface)]">
                                {q.title}
                              </span>
                            </button>
                            <div
                              className="flex flex-wrap items-center gap-1 border-t border-[var(--outline-variant)]/10 px-2 py-1.5"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                title={t("moveUp")}
                                disabled={busy || !canUp}
                                onClick={() => void moveQuestion(q, "up")}
                                className="rounded p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] disabled:opacity-30"
                              >
                                <MaterialIcon name="keyboard_arrow_up" className="!text-lg" />
                              </button>
                              <button
                                type="button"
                                title={t("moveDown")}
                                disabled={busy || !canDown}
                                onClick={() => void moveQuestion(q, "down")}
                                className="rounded p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] disabled:opacity-30"
                              >
                                <MaterialIcon name="keyboard_arrow_down" className="!text-lg" />
                              </button>
                              <button
                                type="button"
                                title={t("editQuestion")}
                                disabled={busy}
                                onClick={() => openEdit(q)}
                                className="rounded p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] disabled:opacity-30"
                              >
                                <MaterialIcon name="edit" className="!text-lg" />
                              </button>
                              <button
                                type="button"
                                title={t("deleteQuestion")}
                                disabled={busy}
                                onClick={() => void deleteQuestion(q)}
                                className="rounded p-1 text-[var(--on-surface-variant)] hover:bg-[var(--error)]/15 hover:text-[var(--error)] disabled:opacity-30"
                              >
                                <MaterialIcon name="delete" className="!text-lg" />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {filteredQuestions.length === 0 && (
                  <p className="py-4 text-sm text-[var(--on-surface-variant)]">{t("emptyRound")}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAddQuestionModalOpen(true)}
                className="mt-3 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--outline-variant)]/35 py-4 text-[var(--on-surface-variant)] transition hover:border-[var(--primary)]/45 hover:bg-[var(--surface-container-high)]/40 hover:text-[var(--primary)]"
              >
                <MaterialIcon name="add_circle" className="!text-xl" />
                <span className="text-sm font-medium">{t("addQuestionShort")}</span>
              </button>
            </div>
          </section>

          <section className="mt-2 flex min-w-0 w-full flex-1 flex-col border-[var(--outline-variant)]/10 bg-[var(--surface)] md:mt-0 md:min-h-0 md:min-w-0 md:flex-[1_1_0] md:overflow-hidden md:border-x">
            <div className="flex min-h-0 flex-1 flex-col px-3 py-4 md:min-h-0 md:px-4">
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

              <div className="space-y-3 pr-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:scrollbar-thin">
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

          <aside
            className={`mt-2 flex shrink-0 flex-col bg-[var(--surface-container-low)] transition-[flex-basis] duration-200 md:mt-0 ${
              transcriptPanelOpen
                ? "min-h-0 min-w-0 overflow-hidden p-4 md:min-h-0 md:flex-[1.08_1_0] md:overflow-hidden md:p-6"
                : "min-h-0 min-w-0 overflow-hidden p-2 md:p-6 lg:flex-[0_0_2.75rem] lg:px-1"
            }`}
          >
            {transcriptPanelOpen ? (
              <>
                <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                  <h2 className="font-headline min-w-0 flex-1 truncate text-lg font-medium text-[var(--on-surface)] md:text-xl lg:text-2xl">
                    {t("transcriptTitle")}
                  </h2>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={exportMarkdown}
                      className="rounded-lg p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
                      title={t("exportMd")}
                    >
                      <MaterialIcon name="download" className="!text-xl" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTranscriptPanelOpen(false)}
                      className="rounded-lg p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
                      title={t("transcriptHidePanel")}
                    >
                      <MaterialIcon name="chevron_right" className="!text-xl" />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--outline-variant)]/10 bg-[var(--surface-container-lowest)] p-3 scrollbar-thin md:p-4">
                  {orderedTranscriptSections.length === 0 ? (
                    <p className="text-xs leading-relaxed text-[var(--on-surface-variant)]">
                      {t("placeholderScript")}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {orderedTranscriptSections.map(({ q, body }) => {
                        const expanded = scriptSectionExpanded[q.id] !== false;
                        const isSel = selectedId === q.id;
                        return (
                          <article
                            key={q.id}
                            id={`script-block-${q.id}`}
                            className={`scroll-mt-3 overflow-hidden rounded-lg border transition-shadow ${
                              isSel
                                ? "border-[var(--primary)]/40 shadow-[0_0_0_1px_var(--primary)]/20"
                                : "border-[var(--outline-variant)]/15"
                            }`}
                          >
                            <button
                              type="button"
                              className="flex w-full items-start gap-2 bg-[var(--surface-container-low)]/90 px-3 py-2.5 text-left transition hover:bg-[var(--surface-container-high)]/80"
                              aria-expanded={expanded}
                              title={t("transcriptSectionToggle")}
                              onClick={() => toggleScriptSection(q.id)}
                            >
                              <MaterialIcon
                                name={expanded ? "expand_less" : "expand_more"}
                                className="mt-0.5 shrink-0 text-[var(--on-surface-variant)]"
                              />
                              <h3 className="font-headline text-sm font-semibold leading-snug text-[var(--on-surface)]">
                                {q.title}
                              </h3>
                            </button>
                            {expanded ? (
                              <div className="border-t border-[var(--outline-variant)]/10 p-3">
                                <AutoGrowTextarea
                                  value={body}
                                  onChange={(e) =>
                                    setScriptById((prev) => ({
                                      ...prev,
                                      [q.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={t("scriptTextareaPlaceholder")}
                                  className="min-h-[7.5rem] w-full resize-none rounded-md border border-[var(--outline-variant)]/25 bg-[var(--surface)] p-3 text-sm leading-relaxed text-[var(--on-surface)] outline-none focus:ring-1 focus:ring-[var(--primary)]/25"
                                />
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-stretch justify-start gap-3 lg:items-center">
                <button
                  type="button"
                  onClick={() => setTranscriptPanelOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--outline-variant)]/25 bg-[var(--surface-container-lowest)] py-3 text-sm font-medium text-[var(--primary)] lg:flex-col lg:py-2 lg:text-xs"
                  title={t("transcriptShowPanel")}
                >
                  <MaterialIcon name="chevron_left" className="!text-xl lg:!text-2xl" />
                  <span className="lg:hidden">{t("transcriptShowPanel")}</span>
                </button>
                <button
                  type="button"
                  onClick={exportMarkdown}
                  className="hidden rounded-lg p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] lg:block"
                  title={t("exportMd")}
                >
                  <MaterialIcon name="download" className="!text-xl" />
                </button>
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>

    {addQuestionModalOpen ? (
      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-question-modal-title"
        onClick={() => closeAddQuestionModal()}
      >
        <div
          className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--outline-variant)]/20 bg-[var(--surface)] shadow-xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--outline-variant)]/15 px-4 py-3">
            <h2
              id="add-question-modal-title"
              className="font-headline text-lg font-semibold text-[var(--on-surface)]"
            >
              {t("addQuestionModalTitle")}
            </h2>
            <button
              type="button"
              onClick={closeAddQuestionModal}
              className="rounded-lg p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
              aria-label={t("addQuestionClose")}
            >
              <MaterialIcon name="close" className="!text-xl" />
            </button>
          </div>
          <div className="space-y-3 overflow-y-auto p-4">
            <p className="text-xs leading-relaxed text-[var(--on-surface-variant)]">
              {t("addQuestionFormatHint")}
            </p>
            <AutoGrowTextarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onPaste={onModalPaste}
              placeholder={t("draftPlaceholder")}
              maxHeightPx={200}
              className="min-h-11 w-full resize-none rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm leading-relaxed text-[var(--on-surface)] outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => draftFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)]/35 bg-[var(--surface-container-low)] px-3 py-2 text-xs font-medium text-[var(--on-surface)] hover:border-[var(--primary)]/40"
              >
                <MaterialIcon name="upload_file" className="!text-base" />
                {t("uploadTitle")}
              </button>
              <button
                type="button"
                onClick={pasteLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--outline-variant)]/35 bg-[var(--surface-container-low)] px-3 py-2 text-xs font-medium text-[var(--on-surface)] hover:border-[var(--primary)]/40"
              >
                <MaterialIcon name="link" className="!text-base" />
                {t("linkTitle")}
              </button>
            </div>
            <input
              ref={draftFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,.txt,text/plain"
              className="hidden"
              onChange={onDraftFile}
            />
            {draftAttachment ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface-container-lowest)] p-2">
                <Image
                  src={draftAttachment.dataUrl}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 rounded object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--on-surface-variant)]">
                  {draftAttachment.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDraftAttachment(null);
                    if (draftFileInputRef.current) draftFileInputRef.current.value = "";
                  }}
                  className="text-xs font-medium text-[var(--primary)]"
                >
                  {t("removeAttachment")}
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void addDraftQuestion()}
              disabled={(!draftText.trim() && !draftAttachment) || addingDraft}
              className="w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-medium text-[var(--on-primary)] transition hover:opacity-95 disabled:opacity-40"
            >
              {t("addToList")}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
