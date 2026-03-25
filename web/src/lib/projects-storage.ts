"use client";

import type { WorkspaceSession } from "@/lib/client-session";

const PROJECTS_KEY = "draftr_projects_v2";
const SESSIONS_KEY = "draftr_project_sessions_v2";

/** 从 Prep 点 Round 进入 Workspace 时要选中的轮次 */
export const PENDING_ROUND_SESSION_KEY = "draftr_pending_round_v1";

export type ProjectCard = {
  id: string;
  /** 列表主标题（自定义或从 JD 推导） */
  title: string;
  role: string;
  date: string;
  progress: number;
  updatedAt: number;
  /** 后端列表返回：题目条数；0 时主入口进准备页 */
  questionCount?: number;
  /** 入门占位卡片：无真实会话，点进入准备页 */
  isStarter?: boolean;
};

const STARTER_ID = "__starter__";

function formatDate(ts: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

function readProjectsRaw(): ProjectCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectCard[];
  } catch {
    return [];
  }
}

function writeProjectsRaw(list: ProjectCard[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
}

function readSessionsRaw(): Record<string, WorkspaceSession> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, WorkspaceSession>;
  } catch {
    return {};
  }
}

function writeSessionsRaw(map: Record<string, WorkspaceSession>) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(map));
}

/** 无用户项目时展示的单个入门卡片（不写进列表，避免污染后端迁移） */
export function getStarterCard(locale: string, starterCompany: string, starterRole: string): ProjectCard {
  return {
    id: STARTER_ID,
    title: starterCompany,
    role: starterRole,
    date: formatDate(Date.now(), locale),
    progress: 0,
    updatedAt: Date.now(),
    isStarter: true,
  };
}

/**
 * 用户真实项目列表；若本地尚无任何项目，则只返回「一个」入门占位（由 UI 传入文案）。
 */
export function getProjects(locale: string, starterCompany: string, starterRole: string): ProjectCard[] {
  const user = readProjectsRaw();
  if (user.length === 0) {
    return [getStarterCard(locale, starterCompany, starterRole)];
  }
  return user;
}

export function getProjectSession(projectId: string): WorkspaceSession | null {
  const map = readSessionsRaw();
  return map[projectId] ?? null;
}

export function saveProjectSession(projectId: string, session: WorkspaceSession) {
  const map = readSessionsRaw();
  map[projectId] = { ...session, projectId };
  writeSessionsRaw(map);
}

export function deleteProjectSession(projectId: string) {
  const map = readSessionsRaw();
  delete map[projectId];
  writeSessionsRaw(map);
}

function firstLine(text: string, max = 56): string {
  const line = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!line) return "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function deriveTitleRole(session: WorkspaceSession): { title: string; role: string } {
  const jdLine = firstLine(session.jd);
  const title = jdLine || "Interview target";
  const role =
    session.analysis?.overallFit?.label?.slice(0, 48) ||
    firstLine(session.jd.split(/\r?\n/).slice(1).join("\n")) ||
    "Role";
  return { title, role };
}

function computeProgress(session: WorkspaceSession): number {
  const n = session.questions?.length ?? 0;
  if (n === 0) return 0;
  const scripts = session.scriptById ?? {};
  const answered = session.questions.filter((q) => scripts[q.id]?.trim()).length;
  return Math.min(100, Math.round((answered / n) * 100));
}

export function buildProjectCard(
  projectId: string,
  session: WorkspaceSession,
  locale: string,
): ProjectCard {
  const { title, role } = deriveTitleRole(session);
  const now = Date.now();
  return {
    id: projectId,
    title,
    role,
    date: formatDate(now, locale),
    progress: computeProgress(session),
    updatedAt: now,
  };
}

/** 合并更新卡片展示字段（日期、进度、标题） */
export function upsertProjectCardFromSession(session: WorkspaceSession, locale: string) {
  const projectId = session.projectId;
  if (!projectId) return;
  const list = readProjectsRaw();
  const card = buildProjectCard(projectId, session, locale);
  const idx = list.findIndex((p) => p.id === projectId);
  if (idx >= 0) {
    list[idx] = { ...card, date: list[idx].date };
  } else {
    list.unshift(card);
  }
  writeProjectsRaw(list);
}

/**
 * Prep 生成题目后：写入会话快照 + 项目卡片（新建或更新同一 projectId）。
 */
export function persistWorkspaceAsProject(session: WorkspaceSession, locale: string): string {
  const id =
    session.projectId ??
    (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`);
  const next: WorkspaceSession = { ...session, projectId: id };
  saveProjectSession(id, next);
  upsertProjectCardFromSession(next, locale);
  return id;
}

export function averageProgress(projects: ProjectCard[]): number | null {
  const real = projects.filter((p) => !p.isStarter);
  if (real.length === 0) return null;
  return Math.round(real.reduce((s, p) => s + p.progress, 0) / real.length);
}
