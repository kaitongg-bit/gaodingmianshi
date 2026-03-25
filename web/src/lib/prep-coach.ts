const key = (projectId: string) => `draftr_prep_coach_${projectId}`;

export type PrepCoachState = {
  /** 用户已关闭「先运行分析」引导，或已成功跑过分析 */
  skipAnalyze?: boolean;
  /** 用户已关闭「生成题目」引导，或已进入工作区 */
  skipGenerate?: boolean;
};

export function readPrepCoach(projectId: string): PrepCoachState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return {};
    return JSON.parse(raw) as PrepCoachState;
  } catch {
    return {};
  }
}

export function patchPrepCoach(projectId: string, patch: Partial<PrepCoachState>) {
  if (typeof window === "undefined") return;
  const prev = readPrepCoach(projectId);
  localStorage.setItem(key(projectId), JSON.stringify({ ...prev, ...patch }));
}
