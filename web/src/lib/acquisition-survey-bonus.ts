/** 完成「如何知道我们」问卷后赠送的积分（与 DB 函数内常量保持一致） */
export const ACQUISITION_SURVEY_BONUS_CREDITS = 20;

export const ACQUISITION_SURVEY_CHANNELS = [
  "tiktok",
  "wechat",
  "xiaohongshu",
  "reddit",
  "other",
] as const;

export type AcquisitionSurveyChannel = (typeof ACQUISITION_SURVEY_CHANNELS)[number];

export function isAcquisitionSurveyChannel(s: string): s is AcquisitionSurveyChannel {
  return (ACQUISITION_SURVEY_CHANNELS as readonly string[]).includes(s);
}
