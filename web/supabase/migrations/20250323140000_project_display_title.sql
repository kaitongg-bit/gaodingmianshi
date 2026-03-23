-- 项目列表展示用自定义标题（为空时仍由 API 从 JD/分析推导）
alter table public.projects
  add column if not exists display_title text;

comment on column public.projects.display_title is '用户或系统设置的短标题；列表优先展示，避免 JD 首行过长';
