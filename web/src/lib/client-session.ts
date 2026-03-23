"use client";

const USER_KEY = "draftr_user_v1";
const WORKSPACE_KEY = "draftr_workspace_v1";

export type AuthUser = { email: string; name?: string };

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(USER_KEY);
}

export type AnalysisPayload = {
  overallFit?: { label?: string; score0to100?: number; oneLiner?: string };
  dimensions?: { name: string; level: string; detail: string }[];
  prepNotes?: {
    strengths?: string;
    gaps?: string;
    likelyQuestionThemes?: string;
  };
};

export type WorkspaceQuestion = {
  id: string;
  round: number;
  title: string;
  imagePreview?: string;
};

export type WorkspaceChatTurn = { role: "user" | "assistant"; content: string };

export type WorkspaceSession = {
  /** 与 projects-storage 中的会话快照对应 */
  projectId?: string;
  resume: string;
  jd: string;
  roundsCount: number;
  analysis: AnalysisPayload | null;
  questions: WorkspaceQuestion[];
  chatById?: Record<string, WorkspaceChatTurn[]>;
  scriptById?: Record<string, string>;
};

export function getWorkspaceSession(): WorkspaceSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceSession;
  } catch {
    return null;
  }
}

export function setWorkspaceSession(data: WorkspaceSession) {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
}

export function clearWorkspaceSession() {
  localStorage.removeItem(WORKSPACE_KEY);
}
