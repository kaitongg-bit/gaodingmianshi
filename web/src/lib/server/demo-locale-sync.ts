import type { SupabaseClient } from "@supabase/supabase-js";
import {
  syncDemoBundleToLocale,
  syncDemoSeedQuestionsToLocale,
  upgradeIfLegacyForkSeedTemplate,
  upgradeLegacyDemoJdEn,
} from "@/lib/demo-copy";

export function profileLocaleToAppLocale(raw: string | null | undefined): "en" | "zh" {
  return raw === "zh" ? "zh" : "en";
}

/** 请求 ?locale= 与当前界面一致时优先，避免 profile 未更新导致英文站仍同步中文演示 */
export function resolveAppLocaleForSync(
  queryLocale: string | null | undefined,
  profileLocale: string | null | undefined,
): "en" | "zh" {
  if (queryLocale === "zh" || queryLocale === "en") return queryLocale;
  return profileLocaleToAppLocale(profileLocale);
}

type ProjectRow = {
  id: string;
  resume_text: string | null;
  jd_text: string | null;
};

type QuestionRow = { id: string; round_index: number; title: string };

/**
 * 将 fork 下来的中文系统模板（简历/JD/种子题）按用户 profile.locale 写回数据库并更新内存中的行。
 * 与客户端 Prep/Workspace 逻辑一致，避免首屏闪中文或依赖浏览器 PATCH 时序。
 */
export async function applyDemoLocaleSync(
  supabase: SupabaseClient,
  locale: "en" | "zh",
  project: ProjectRow,
  questions: QuestionRow[] | null,
): Promise<void> {
  let resume = project.resume_text ?? "";
  let jd = project.jd_text ?? "";
  let resumeOut = resume;
  let jdOut = jd;
  const projectPatch: Record<string, string> = {};

  const forkDemo = upgradeIfLegacyForkSeedTemplate(resume, jd, locale);
  if (forkDemo) {
    resumeOut = forkDemo.resume;
    jdOut = forkDemo.jd;
    projectPatch.resume_text = resumeOut;
    projectPatch.jd_text = jdOut;
  } else {
    const bundle = syncDemoBundleToLocale(resume, jd, locale);
    if (bundle) {
      resumeOut = bundle.resume;
      jdOut = bundle.jd;
      projectPatch.resume_text = resumeOut;
      projectPatch.jd_text = jdOut;
    } else {
      const jdUp = upgradeLegacyDemoJdEn(jd);
      if (jdUp) {
        jdOut = jdUp;
        projectPatch.jd_text = jdOut;
      }
    }
  }

  if (Object.keys(projectPatch).length > 0) {
    const { error } = await supabase.from("projects").update(projectPatch).eq("id", project.id);
    if (!error) {
      project.resume_text = resumeOut;
      project.jd_text = jdOut;
    }
  }

  if (!questions?.length) return;

  const qUpdates = syncDemoSeedQuestionsToLocale(
    questions.map((q) => ({ id: q.id, round: q.round_index, title: q.title })),
    locale,
  );
  if (!qUpdates) return;

  for (const u of qUpdates) {
    const { error } = await supabase
      .from("questions")
      .update({ title: u.title })
      .eq("id", u.id)
      .eq("project_id", project.id);
    if (error) return;
  }
  for (const q of questions) {
    const u = qUpdates.find((x) => x.id === q.id);
    if (u) q.title = u.title;
  }
}
