"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
import {
  QUESTION_TOPIC_ORDER,
  QUESTION_TOPIC_SLUGS,
  type QuestionTopicSlug,
} from "@/lib/question-topics";
import { clampRoundsCount, MAX_INTERVIEW_ROUNDS } from "@/lib/project-rounds";

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
  if (err === "empty_reply") return t("chatEmptyReply");
  if (err === "chat_failed") return t("chatStreamFailed");
  return err ?? "error";
}

function mapExtractError(
  code: string | undefined,
  t: ReturnType<typeof useTranslations<"Workspace">>,
): string {
  if (code === "missing_api_key") return t("apiKeyMissing");
  if (code === "insufficient_credits") return t("insufficientCredits");
  if (code === "unauthorized") return t("loginRequired");
  if (code === "no_questions_found") return t("extractNoQuestions");
  if (code === "need_text_or_image") return t("extractNeedInput");
  if (code === "model_json_invalid") return t("extractModelError");
  return t("extractFailed");
}

function buildInterviewMarkdown(
  mode: "round" | "topic",
  questions: WorkspaceQuestion[],
  scriptById: Record<string, string>,
  t: ReturnType<typeof useTranslations<"Workspace">>,
  opts?: { onlyRound?: number },
): string {
  const pending = (title: string) => `${t("scriptPending")} ${title}`;
  const bodyFor = (q: WorkspaceQuestion) =>
    scriptById[q.id]?.trim() || pending(q.title);

  const topicTag = (q: WorkspaceQuestion) => {
    const slug = displayTopicSlug(q);
    return ` _(${t(`topic_${slug}`)})_`;
  };

  const qs =
    opts?.onlyRound != null
      ? questions.filter((q) => q.round === opts.onlyRound)
      : questions;

  if (mode === "round") {
    const byRound = new Map<number, WorkspaceQuestion[]>();
    for (const q of qs) {
      const arr = byRound.get(q.round) ?? [];
      arr.push(q);
      byRound.set(q.round, arr);
    }
    const rounds = [...byRound.keys()].sort((a, b) => a - b);
    const lines: string[] = [];
    for (const r of rounds) {
      lines.push(`# ${t("exportRoundHeading", { n: r })}`, "");
      const list = byRound.get(r)!;
      list.forEach((q, i) => {
        lines.push(`## ${i + 1}. ${q.title}${topicTag(q)}`, "", bodyFor(q), "");
      });
    }
    return `${lines.join("\n").trim()}\n`;
  }

  const byCat = new Map<string, WorkspaceQuestion[]>();
  for (const q of qs) {
    const c =
      q.topicCategory && (QUESTION_TOPIC_SLUGS as readonly string[]).includes(q.topicCategory)
        ? q.topicCategory
        : "other";
    const arr = byCat.get(c) ?? [];
    arr.push(q);
    byCat.set(c, arr);
  }
  const lines: string[] = [];
  for (const slug of QUESTION_TOPIC_ORDER) {
    const list = byCat.get(slug);
    if (!list?.length) continue;
    lines.push(`# ${t(`topic_${slug}`)}`, "");
    const sorted = [...list].sort(
      (a, b) => a.round - b.round || a.title.localeCompare(b.title),
    );
    sorted.forEach((q, i) => {
      lines.push(
        `## ${i + 1}. ${t("exportRoundInline", { n: q.round })} ${q.title}`,
        "",
        bodyFor(q),
        "",
      );
    });
  }
  return `${lines.join("\n").trim()}\n`;
}

function displayTopicSlug(q: WorkspaceQuestion): QuestionTopicSlug {
  const c = q.topicCategory;
  if (c && (QUESTION_TOPIC_SLUGS as readonly string[]).includes(c)) {
    return c as QuestionTopicSlug;
  }
  return "other";
}

/** 异步加载路径不用 t()，避免 next-intl 在键未合并进客户端 messages 时报 MISSING_MESSAGE */
const WS_BOOT_FALLBACK = {
  workspacePartialLoad: {
    en: "Some data could not be loaded (questions or chat history). You can keep working here — refresh if something looks missing.",
    zh: "部分数据未能加载（题目或对话历史）。仍可继续在工作区操作；若内容不全请刷新页面。",
  },
  workspaceLoadFailed: {
    en: "Could not load this workspace. Check your connection and try again.",
    zh: "无法加载工作区，请检查网络后重试。",
  },
  workspaceProjectMissing: {
    en: "This project was not found or you don't have access to it.",
    zh: "未找到该项目，或你无权访问。",
  },
  workspaceLoadRetry: {
    en: "Try again",
    zh: "重试",
  },
} as const;

function workspaceBootString(
  messages: Record<string, unknown>,
  key: keyof typeof WS_BOOT_FALLBACK,
  locale: string,
): string {
  const ws = messages.Workspace as Record<string, unknown> | undefined;
  const raw = ws?.[key];
  if (typeof raw === "string" && raw.trim().length > 0) return raw;
  const fb = WS_BOOT_FALLBACK[key];
  return locale === "zh" ? fb.zh : fb.en;
}

export function WorkspaceClient() {
  const t = useTranslations("Workspace");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const intlMessages = useMessages() as Record<string, unknown>;
  const intlMessagesRef = useRef(intlMessages);
  intlMessagesRef.current = intlMessages;
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const searchParams = useSearchParams();
  const projectQuery = searchParams.get("project") ?? "";
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [workspaceBootstrapError, setWorkspaceBootstrapError] = useState<string | null>(null);
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
  const [removeRoundBusy, setRemoveRoundBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRound, setEditRound] = useState(1);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  /** false = 本题逐字稿区块收起；缺省为展开 */
  const [scriptSectionExpanded, setScriptSectionExpanded] = useState<Record<string, boolean>>({});
  const [transcriptPanelOpen, setTranscriptPanelOpen] = useState(true);
  const [addQuestionModalOpen, setAddQuestionModalOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSortMode, setExportSortMode] = useState<"round" | "topic">("round");
  const [exportScope, setExportScope] = useState<"all" | "currentRound">("all");
  const [editTopic, setEditTopic] = useState<QuestionTopicSlug>("other");
  const [chatPasteNotice, setChatPasteNotice] = useState<string | null>(null);

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
    if (session.roundsCount >= MAX_INTERVIEW_ROUNDS) return;
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

  const handleRemoveRound = useCallback(
    async (round: number) => {
      if (!projectQuery || !session || session.roundsCount <= 1) return;
      if (!window.confirm(tNav("removeRoundConfirm", { n: round }))) return;
      setRemoveRoundBusy(true);
      setError(null);
      try {
        const del = await fetch(`/api/projects/${projectQuery}/rounds/${round}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const dj = (await del.json()) as { error?: string };
        if (!del.ok) {
          setError(
            dj.error === "cannot_remove_last_round" ? t("removeRoundLast") : t("removeRoundFailed"),
          );
          return;
        }
        const r = await fetch(`/api/projects/${projectQuery}/workspace`, {
          credentials: "same-origin",
        });
        const j = (await r.json()) as {
          project?: {
            id: string;
            resume_text: string;
            jd_text: string;
            rounds_count: number | null;
            active_round: number | null;
            analysis_jsonb: unknown;
          };
          questions?: WorkspaceQuestion[];
          chatById?: Record<string, ChatTurn[]>;
          scriptById?: Record<string, string>;
        };
        if (!r.ok || !j.project) {
          setLoadAttempt((n) => n + 1);
          return;
        }
        const proj = j.project;
        const list = j.questions ?? [];
        const roundsCoerced = clampRoundsCount(Number(proj.rounds_count) || 3);
        const ws: WorkspaceSession = {
          projectId: proj.id,
          resume: proj.resume_text ?? "",
          jd: proj.jd_text ?? "",
          roundsCount: roundsCoerced,
          analysis: (proj.analysis_jsonb ?? null) as AnalysisPayload | null,
          questions: list,
          chatById: j.chatById ?? {},
          scriptById: j.scriptById ?? {},
        };
        setSession(ws);
        setQuestions(list.map((q) => ({ ...q })));
        setChatById(j.chatById ?? {});
        setScriptById(j.scriptById ?? {});
        const ar = Math.min(
          roundsCoerced,
          Math.max(1, Number(proj.active_round) || 1),
        );
        setActiveRound(ar);
        const pick = list.find((q) => q.round === ar) ?? list[0];
        setSelectedId(pick?.id ?? null);
        setEditingId(null);
      } catch {
        setError("network");
      } finally {
        setRemoveRoundBusy(false);
      }
    },
    [projectQuery, session, t, tNav],
  );

  useEffect(() => {
    if (!projectQuery || !UUID_RE.test(projectQuery)) {
      routerRef.current.replace("/projects");
      return;
    }
    let cancelled = false;
    setCloudReady(false);
    setSession(null);
    setWorkspaceBootstrapError(null);

    async function loadWorkspace(after401Refresh: boolean): Promise<void> {
      if (cancelled) return;
      const r = await fetch(`/api/projects/${projectQuery}/workspace`, {
        credentials: "same-origin",
      });
      if (cancelled) return;

      type BootJson = {
        project?: {
          id: string;
          resume_text: string;
          jd_text: string;
          rounds_count: number | null;
          active_round: number | null;
          analysis_jsonb: unknown;
        };
        questions?: WorkspaceQuestion[];
        chatById?: Record<string, ChatTurn[]>;
        scriptById?: Record<string, string>;
        error?: string;
        message?: string;
      };

      let j: BootJson;
      try {
        j = (await r.json()) as BootJson;
      } catch {
        if (!cancelled) {
          setWorkspaceBootstrapError(
            workspaceBootString(intlMessagesRef.current, "workspaceLoadFailed", localeRef.current),
          );
        }
        return;
      }
      if (cancelled) return;

      if (r.status === 401 && !after401Refresh) {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.refreshSession();
        if (cancelled) return;
        await loadWorkspace(true);
        return;
      }

      const proj = j.project;
      if (proj) {
        const qs = j.questions ?? [];
        const roundsCoerced = clampRoundsCount(Number(proj.rounds_count) || 3);
        const ws: WorkspaceSession = {
          projectId: proj.id,
          resume: proj.resume_text ?? "",
          jd: proj.jd_text ?? "",
          roundsCount: roundsCoerced,
          analysis: (proj.analysis_jsonb ?? null) as AnalysisPayload | null,
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
            Math.max(1, Number(proj.active_round) || 1),
          );
          setActiveRound(ar);
          const pick = qs.find((q) => q.round === ar) ?? qs[0];
          setSelectedId(pick?.id ?? null);
        }

        setCloudReady(true);
        if (r.ok) {
          setError(null);
        } else if (j.error === "questions_failed" || j.error === "messages_failed") {
          setError(
            workspaceBootString(intlMessagesRef.current, "workspacePartialLoad", localeRef.current),
          );
        } else {
          setError(
            workspaceBootString(intlMessagesRef.current, "workspaceLoadFailed", localeRef.current),
          );
        }
        return;
      }

      if (r.status === 401) {
        if (!cancelled) routerRef.current.replace("/auth/login");
        return;
      }
      if (r.status === 404) {
        if (!cancelled) {
          setWorkspaceBootstrapError(
            workspaceBootString(intlMessagesRef.current, "workspaceProjectMissing", localeRef.current),
          );
        }
        return;
      }
      if (!cancelled) {
        setWorkspaceBootstrapError(
          j.error ??
            j.message ??
            workspaceBootString(intlMessagesRef.current, "workspaceLoadFailed", localeRef.current),
        );
      }
    }

    void loadWorkspace(false);

    return () => {
      cancelled = true;
    };
  }, [projectQuery, loadAttempt]);

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
    const tc = q.topicCategory;
    setEditTopic(
      tc && (QUESTION_TOPIC_SLUGS as readonly string[]).includes(tc)
        ? (tc as QuestionTopicSlug)
        : "other",
    );
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
    setEditRound(1);
    setEditTopic("other");
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
        body: JSON.stringify({ title, round: editRound, topic_category: editTopic }),
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
                  topicCategory: j.question!.topicCategory ?? x.topicCategory,
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
    editTopic,
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
      } catch {
        setError("network");
      } finally {
        setRowBusy(null);
      }
    },
    [projectQuery, questions, activeRound, selectedId, editingId, cancelEdit, t],
  );

  const patchQuestionTopic = useCallback(
    async (qid: string, slug: QuestionTopicSlug) => {
      if (!projectQuery) return;
      setRowBusy(qid);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectQuery}/questions/${qid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic_category: slug }),
        });
        const j = (await res.json()) as {
          question?: { id: string; topicCategory?: string };
          error?: string;
        };
        if (!res.ok) {
          setError(j.error ?? "save_failed");
          return;
        }
        if (j.question) {
          setQuestions((prev) =>
            prev.map((x) =>
              x.id === qid ? { ...x, topicCategory: j.question!.topicCategory } : x,
            ),
          );
        }
      } catch {
        setError("network");
      } finally {
        setRowBusy(null);
      }
    },
    [projectQuery],
  );

  const onChatPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it?.kind === "file" && it.type.startsWith("image/")) {
          e.preventDefault();
          setChatPasteNotice(t("chatNoImages"));
          window.setTimeout(() => setChatPasteNotice(null), 2800);
          return;
        }
      }
    },
    [t],
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
    const qid = selectedQ.id;
    const prev = chatById[qid] ?? [];
    const nextMsgs = [...prev, { role: "user" as const, content: userMsg }];
    setChatById((m) => ({ ...m, [qid]: nextMsgs }));
    setLoadingChat(true);
    let fullReply = "";
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
        setChatById((m) => ({ ...m, [qid]: prev }));
        return;
      }
      fullReply = json.reply ?? "";

      if (!fullReply.trim()) {
        setError(mapChatError("empty_reply", t));
        setChatById((m) => ({ ...m, [qid]: prev }));
        return;
      }

      const u = await fetch(`/api/questions/${qid}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: userMsg }),
      });
      if (!u.ok) {
        setChatById((m) => ({ ...m, [qid]: prev }));
        setError("save_failed");
        return;
      }
      const a = await fetch(`/api/questions/${qid}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "assistant", content: fullReply.trim() }),
      });
      if (!a.ok) {
        setChatById((m) => ({ ...m, [qid]: prev }));
        setError("save_failed");
        return;
      }

      const trimmed = fullReply.trim();
      setChatById((m) => ({
        ...m,
        [qid]: [...nextMsgs, { role: "assistant" as const, content: trimmed }],
      }));
    } catch {
      setError("network");
      setChatById((m) => ({ ...m, [qid]: prev }));
    } finally {
      setLoadingChat(false);
    }
  }, [selectedQ, chatInput, chatById, locale, session, t]);

  const closeAddQuestionModal = useCallback(() => {
    setAddQuestionModalOpen(false);
    setDraftText("");
    setDraftAttachment(null);
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

  useEffect(() => {
    if (!addQuestionModalOpen) return;
    const id = requestAnimationFrame(() => {
      draftTextareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [addQuestionModalOpen]);

  const pasteShortcut = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl+V";
    return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘V" : "Ctrl+V";
  }, []);

  const openExportDialog = useCallback(() => {
    setExportSortMode("round");
    setExportScope("all");
    setExportDialogOpen(true);
  }, []);

  const confirmExportMarkdown = useCallback(() => {
    const onlyRound = exportScope === "currentRound" ? activeRound : undefined;
    const md = buildInterviewMarkdown(exportSortMode, questions, scriptById, t, {
      onlyRound,
    });
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      exportScope === "currentRound"
        ? `interview-script-round-${activeRound}-${locale}.md`
        : `interview-script-${locale}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    setExportDialogOpen(false);
  }, [exportSortMode, exportScope, activeRound, questions, scriptById, locale, t]);

  const addDraftQuestion = useCallback(async () => {
    const text = draftText.trim();
    if (!text && !draftAttachment) return;
    if (!projectQuery) return;
    setAddingDraft(true);
    setError(null);
    const attachment_url =
      draftAttachment && draftAttachment.dataUrl.length < 12_000
        ? draftAttachment.dataUrl
        : null;

    /** 仅粘贴/上传截图时走 AI（识图、拆题、主题）；纯文字直接入库，不扣识图积分 */
    const shouldUseAi = draftAttachment != null;

    try {
      if (shouldUseAi) {
        const ex = await fetch("/api/ai/extract-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: draftAttachment?.dataUrl,
            text: text || undefined,
            locale,
          }),
        });
        const ej = (await ex.json()) as {
          error?: string;
          items?: { title: string; category: string }[];
        };
        if (!ex.ok) {
          setError(mapExtractError(ej.error, t));
          return;
        }
        const items = ej.items ?? [];
        const batchItems = items.map((it, i) => ({
          title: it.title,
          topic_category: it.category,
          attachment_url: i === 0 ? attachment_url : null,
        }));
        const res = await fetch(`/api/projects/${projectQuery}/questions/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round: activeRound, items: batchItems }),
        });
        const j = (await res.json()) as {
          questions?: {
            id: string;
            round: number;
            title: string;
            source?: "ai" | "user";
            imagePreview?: string;
            topicCategory?: string;
          }[];
          error?: string;
        };
        if (!res.ok || !j.questions?.length) {
          setError(j.error ?? "add_failed");
          return;
        }
        const created = j.questions.map((q) => ({
          id: q.id,
          round: q.round,
          title: q.title,
          source: (q.source ?? "user") as "ai" | "user",
          imagePreview: q.imagePreview,
          topicCategory: q.topicCategory,
        }));
        setQuestions((prev) => [...prev, ...created]);
        setSelectedId(created[created.length - 1].id);
        closeAddQuestionModal();
        return;
      }

      const res = await fetch(`/api/projects/${projectQuery}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: text,
          round: activeRound,
          source: "user",
          attachment_url,
          topic_category: "other",
        }),
      });
      const j = (await res.json()) as {
        question?: {
          id: string;
          round: number;
          title: string;
          imagePreview?: string;
          topicCategory?: string;
        };
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
          topicCategory: q.topicCategory,
        },
      ]);
      setSelectedId(q.id);
      closeAddQuestionModal();
    } catch {
      setError("network");
    } finally {
      setAddingDraft(false);
    }
  }, [
    draftText,
    draftAttachment,
    activeRound,
    projectQuery,
    locale,
    t,
    closeAddQuestionModal,
  ]);

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
    if (workspaceBootstrapError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--background)] px-4 text-center text-sm text-[var(--on-surface-variant)]">
          <p className="max-w-md leading-relaxed">{workspaceBootstrapError}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] transition hover:opacity-95"
              onClick={() => setLoadAttempt((n) => n + 1)}
            >
              {workspaceBootString(intlMessagesRef.current, "workspaceLoadRetry", locale)}
            </button>
            {UUID_RE.test(projectQuery) ? (
              <Link
                href={`/prep?project=${projectQuery}`}
                className="rounded-full border border-[var(--outline-variant)]/40 px-4 py-2 text-sm font-medium text-[var(--on-surface)] transition hover:bg-[var(--surface-container-low)]"
              >
                {t("goPrep")}
              </Link>
            ) : null}
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-sm text-[var(--on-surface-variant)]">
        …
      </div>
    );
  }

  return (
    <>
    <div className="flex h-[100dvh] max-h-[100dvh] w-full min-h-0 flex-col overflow-hidden bg-[var(--background)]">
      <DraftNav
        variant="app"
        activeStep={activeRound}
        roundsCount={roundsCount}
        onRoundSelect={onRoundSelect}
        prepProjectId={projectQuery}
        onAddRound={handleAddRound}
        addRoundBusy={addRoundBusy}
        onRemoveRound={handleRemoveRound}
        removeRoundBusy={removeRoundBusy}
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
          className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-0 overflow-hidden px-4 pb-3 md:h-full md:min-h-0 md:flex-row md:px-8 md:pb-4"
        >
          <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border-b border-[var(--outline-variant)]/10 bg-[var(--surface-container-low)] p-4 md:w-[min(22rem,100%)] md:max-w-sm md:flex-none md:shrink-0 md:border-b-0 md:border-r md:p-6">
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

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <h3 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                {t("generated")}
              </h3>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 scrollbar-thin">
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
                            <label className="flex flex-col gap-1 text-xs text-[var(--on-surface-variant)]">
                              <span className="font-medium">{t("editTopicLabel")}</span>
                              <select
                                value={editTopic}
                                onChange={(e) => setEditTopic(e.target.value as QuestionTopicSlug)}
                                className="rounded border border-[var(--outline-variant)]/40 bg-[var(--surface-container-lowest)] px-2 py-1.5 text-[var(--on-surface)]"
                              >
                                {QUESTION_TOPIC_SLUGS.map((slug) => (
                                  <option key={slug} value={slug}>
                                    {t(`topic_${slug}`)}
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
                              onClick={() => {
                                setSelectedId(q.id);
                              }}
                              className={`flex w-full gap-3 p-3 pb-2 text-left transition hover:bg-[var(--surface-container-high)]/60 ${
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
                              className="flex items-center gap-0.5 border-t border-[var(--outline-variant)]/10 px-2 py-1"
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
                              <div className="ml-auto flex min-w-0 items-center gap-0.5">
                                <label className="sr-only" htmlFor={`topic-${q.id}`}>
                                  {t("topicPickerTitle")}
                                </label>
                                <select
                                  id={`topic-${q.id}`}
                                  aria-label={t("topicPickerTitle")}
                                  title={t("topicPickerTitle")}
                                  disabled={busy}
                                  value={displayTopicSlug(q)}
                                  onChange={(e) =>
                                    void patchQuestionTopic(q.id, e.target.value as QuestionTopicSlug)
                                  }
                                  className="max-w-[6.5rem] cursor-pointer truncate rounded border border-[var(--outline-variant)]/25 bg-[var(--surface-container-lowest)] py-0.5 pl-1 pr-1 text-[10px] leading-tight text-[var(--on-surface-variant)] outline-none hover:border-[var(--primary)]/30 disabled:cursor-not-allowed disabled:opacity-40 sm:max-w-[7.5rem]"
                                >
                                  {QUESTION_TOPIC_SLUGS.map((slug) => (
                                    <option key={slug} value={slug}>
                                      {t(`topic_${slug}`)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  title={t("deleteQuestion")}
                                  disabled={busy}
                                  onClick={() => void deleteQuestion(q)}
                                  className="shrink-0 rounded p-1 text-[var(--on-surface-variant)] hover:bg-[var(--error)]/15 hover:text-[var(--error)] disabled:opacity-30"
                                >
                                  <MaterialIcon name="delete" className="!text-lg" />
                                </button>
                              </div>
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

          <section className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden border-[var(--outline-variant)]/10 bg-[var(--surface)] md:mt-0 md:flex-[1_1_0] md:border-x">
            <div className="flex h-full min-h-0 flex-1 flex-col px-3 py-4 md:px-4">
              <header className="mb-3 shrink-0">
                <h2 className="font-headline text-xl font-medium text-[var(--on-surface)] md:text-2xl">
                  {t("iterateTitle")}
                </h2>
                {selectedQ ? (
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                    {t("refining")}{" "}
                    <span className="whitespace-pre-wrap break-words text-[var(--primary)] italic">
                      {selectedQ.title}
                    </span>
                  </p>
                ) : null}
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 scrollbar-thin">
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
                {selectedQ && loadingChat ? (
                  <div
                    className="mr-auto flex max-w-[92%] items-center rounded-2xl border border-[var(--outline-variant)]/20 bg-[var(--surface-container-low)] px-5 py-4"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <span className="inline-flex h-6 items-end gap-1.5" aria-hidden>
                      <span
                        className="chat-bounce-dot inline-block h-2 w-2 rounded-full bg-[var(--primary)]/70"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="chat-bounce-dot inline-block h-2 w-2 rounded-full bg-[var(--primary)]/70"
                        style={{ animationDelay: "0.12s" }}
                      />
                      <span
                        className="chat-bounce-dot inline-block h-2 w-2 rounded-full bg-[var(--primary)]/70"
                        style={{ animationDelay: "0.24s" }}
                      />
                    </span>
                    <span className="sr-only">{t("chatGenerating")}</span>
                  </div>
                ) : null}
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
                <div className="flex flex-col gap-1">
                  {selectedQ ? (
                    <p className="text-[11px] leading-snug text-[var(--on-surface-variant)]">
                      {t("chatFollowUpHint")}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--primary)]/25"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onPaste={onChatPaste}
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
                  {chatPasteNotice ? (
                    <p className="text-xs text-amber-800" role="status">
                      {chatPasteNotice}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <aside
            className={`flex min-h-0 flex-col overflow-hidden bg-[var(--surface-container-low)] transition-[flex-basis] duration-200 md:mt-0 ${
              transcriptPanelOpen
                ? "min-w-0 flex-1 p-4 md:flex-[1.08_1_0] md:p-6"
                : "shrink-0 border-t border-[var(--outline-variant)]/10 p-2 md:flex-none md:border-t-0 md:p-6 lg:w-[2.75rem] lg:min-w-[2.75rem] lg:px-1"
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
                      onClick={openExportDialog}
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
                  onClick={openExportDialog}
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
          <div className="space-y-4 overflow-y-auto px-5 pb-5 pt-1">
            <div
              className={`rounded-2xl border-2 border-dashed px-4 py-4 transition-colors ${
                draftAttachment
                  ? "border-[var(--primary)]/40 bg-[var(--primary)]/5"
                  : "border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)]/50"
              }`}
              onPaste={onModalPaste}
            >
              <p className="text-sm leading-relaxed text-[var(--on-surface)]">
                {t("addQuestionFormatHint")}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--on-surface-variant)]">
                {t("addQuestionAiScopeNote")}
              </p>
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--surface)]/80 px-2.5 py-2 text-xs text-[var(--primary)]">
                <MaterialIcon name="content_paste" className="!text-base shrink-0 opacity-90" />
                <span>{t("pasteScreenshotHint", { shortcut: pasteShortcut })}</span>
              </p>
              <AutoGrowTextarea
                ref={draftTextareaRef}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={t("draftPlaceholder")}
                maxHeightPx={220}
                className="mt-3 min-h-[5.5rem] w-full resize-none rounded-xl border border-[var(--outline-variant)]/25 bg-[var(--surface)] px-3 py-3 text-sm leading-relaxed text-[var(--on-surface)] outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
              {draftAttachment ? (
                <div
                  className="mt-3 flex items-center gap-3 border-t border-[var(--outline-variant)]/15 pt-3"
                  role="status"
                  aria-live="polite"
                >
                  <Image
                    src={draftAttachment.dataUrl}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-[var(--outline-variant)]/20"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--on-surface)]">{t("pasteAttachedLabel")}</p>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--on-surface-variant)]">
                      {draftAttachment.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftAttachment(null)}
                    className="shrink-0 text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    {t("removeAttachment")}
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void addDraftQuestion()}
              disabled={(!draftText.trim() && !draftAttachment) || addingDraft}
              className="w-full rounded-xl bg-[var(--primary)] py-3.5 text-sm font-medium text-[var(--on-primary)] shadow-sm transition hover:opacity-95 disabled:opacity-40"
            >
              {addingDraft ? t("extracting") : t("addToList")}
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {exportDialogOpen ? (
      <div
        className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-md-title"
        onClick={() => setExportDialogOpen(false)}
      >
        <div
          className="w-full max-w-md rounded-t-2xl border border-[var(--outline-variant)]/20 bg-[var(--surface)] p-5 shadow-xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="export-md-title"
            className="font-headline text-lg font-semibold text-[var(--on-surface)]"
          >
            {t("exportDialogTitle")}
          </h2>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">{t("exportDialogHint")}</p>
          <fieldset className="mt-4 space-y-3">
            <legend className="sr-only">{t("exportScopeLegend")}</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--outline-variant)]/20 p-3 has-[:checked]:border-[var(--primary)]/40 has-[:checked]:bg-[var(--primary)]/5">
              <input
                type="radio"
                name="exportScope"
                checked={exportScope === "all"}
                onChange={() => setExportScope("all")}
                className="mt-1 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--on-surface)]">
                  {t("exportScopeAll")}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--on-surface-variant)]">
                  {t("exportScopeAllSub")}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--outline-variant)]/20 p-3 has-[:checked]:border-[var(--primary)]/40 has-[:checked]:bg-[var(--primary)]/5">
              <input
                type="radio"
                name="exportScope"
                checked={exportScope === "currentRound"}
                onChange={() => setExportScope("currentRound")}
                className="mt-1 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--on-surface)]">
                  {t("exportScopeCurrentRound", { n: activeRound })}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--on-surface-variant)]">
                  {t("exportScopeCurrentRoundSub")}
                </span>
              </span>
            </label>
          </fieldset>
          <fieldset className="mt-4 space-y-3">
            <legend className="sr-only">{t("exportSortLegend")}</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--outline-variant)]/20 p-3 has-[:checked]:border-[var(--primary)]/40 has-[:checked]:bg-[var(--primary)]/5">
              <input
                type="radio"
                name="exportSort"
                checked={exportSortMode === "round"}
                onChange={() => setExportSortMode("round")}
                className="mt-1 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--on-surface)]">
                  {t("exportSortByRound")}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--on-surface-variant)]">
                  {t("exportSortByRoundSub")}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--outline-variant)]/20 p-3 has-[:checked]:border-[var(--primary)]/40 has-[:checked]:bg-[var(--primary)]/5">
              <input
                type="radio"
                name="exportSort"
                checked={exportSortMode === "topic"}
                onChange={() => setExportSortMode("topic")}
                className="mt-1 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--on-surface)]">
                  {t("exportSortByTopic")}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--on-surface-variant)]">
                  {t("exportSortByTopicSub")}
                </span>
              </span>
            </label>
          </fieldset>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setExportDialogOpen(false)}
              className="flex-1 rounded-xl border border-[var(--outline-variant)]/35 py-3 text-sm font-medium text-[var(--on-surface)]"
            >
              {t("exportCancel")}
            </button>
            <button
              type="button"
              onClick={confirmExportMarkdown}
              className="flex-1 rounded-xl bg-[var(--primary)] py-3 text-sm font-medium text-[var(--on-primary)]"
            >
              {t("exportConfirm")}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
