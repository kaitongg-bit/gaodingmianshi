/** 面试轮次上限（与 DB projects.rounds_count 一致） */
export const MAX_INTERVIEW_ROUNDS = 12;
export const MIN_INTERVIEW_ROUNDS = 1;

export function clampRoundsCount(n: number): number {
  return Math.min(
    MAX_INTERVIEW_ROUNDS,
    Math.max(MIN_INTERVIEW_ROUNDS, Math.floor(Number(n) || MIN_INTERVIEW_ROUNDS)),
  );
}
