-- 面试题主题分类（导出可按标签聚合；AI 提取时写入）
alter table public.questions
  add column if not exists topic_category text;

alter table public.questions drop constraint if exists questions_topic_category_check;

alter table public.questions
  add constraint questions_topic_category_check check (
    topic_category is null
    or topic_category in (
      'resume_deep',
      'career_motivation',
      'technical',
      'domain_general',
      'behavioral_soft',
      'other'
    )
  );

create index if not exists questions_project_topic_idx on public.questions (project_id, topic_category);
