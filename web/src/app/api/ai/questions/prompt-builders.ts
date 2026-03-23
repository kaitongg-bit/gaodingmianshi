/** 与生成题目接口共用的轮次配额说明（共 20 题） */
export function buildQuestionRoundPlan(rounds: number): string {
  if (rounds === 1) {
    return "EXACT COUNTS: Round 1 only — exactly 20 questions (still follow Round-1 style below).";
  }
  if (rounds === 2) {
    return "EXACT COUNTS: Round 1 — exactly 12 questions. Round 2 — exactly 8 questions. Total 20.";
  }
  if (rounds === 3) {
    return [
      "EXACT COUNTS (total 20, do not deviate):",
      "- Round 1 (first interview / 一面): exactly 10 questions.",
      "- Round 2 (二面): exactly 5 questions.",
      "- Round 3 (三面): exactly 5 questions.",
    ].join("\n");
  }
  if (rounds === 4) {
    return [
      "EXACT COUNTS: Round 1 — 8, Round 2 — 4, Round 3 — 4, Round 4 — 4 (total 20).",
      "Round 1 keeps the resume-heavy / pressure style; later rounds go deeper or broader as appropriate.",
    ].join("\n");
  }
  return [
    "EXACT COUNTS: Round 1 — 6, Round 2 — 4, Round 3 — 4, Round 4 — 3, Round 5 — 3 (total 20).",
    "Round 1 keeps the resume-heavy / pressure style.",
  ].join("\n");
}

export function buildQuestionStyleBlock(maxRounds: number): string {
  return `
INTENT: Practice questions BEFORE a real interview only. Never help cheat during a live interview.

ROLE: You design a *strict, skeptical* prep bank. The interviewer persona should be inferred from the JD: act as a **senior hiring manager / domain expert** in that industry (not a generic "interview coach" tone in the question wording).

ROUND THEMES (adapt titles to this resume + JD):

- **Round 1 (一面)** — when this round exists, it is **resume-centric**:
  - Self-introduction belongs here.
  - **Resume deep-dive & pressure**: challenge project claims, metrics, trade-offs, responsibility boundaries; hunt for inconsistencies or weak evidence.
  - **Super-strict interviewer**: poke holes, "what if" stress tests; if the JD demands something important that is *missing or thin* on the resume, ask a pointed question about that gap.
  - **Only 1–2** questions may be broader (e.g. short planning / context); **all other** Round-1 questions must grill resume + JD fit.

- **Round 2 (二面)** — avoid repeating Round-1 verbatim; go deeper on technical depth, systems, ownership, or scenarios implied by the JD.

- **Round 3 (三面)** — motivation, career choice, values, education/background, "why this role/domain", character under pressure.

- **More than 3 rounds**: early = resume/JD pressure; later = depth, leadership, culture/strategy as the JD suggests.

OUTPUT: Return ONLY JSON: { "questions": [ { "round": number, "title": string } ] }
Exactly 20 items. "round" must be an integer from 1 to ${maxRounds}.
Each "title" is one concrete interview-style question (specific, not generic platitudes).
`.trim();
}
