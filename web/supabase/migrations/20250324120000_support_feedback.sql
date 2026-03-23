-- 用户反馈 / Bug 上报（后台可在 Supabase Table Editor 查看）
create table if not exists public.support_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('feedback', 'bug')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_feedback_user_id_idx on public.support_feedback (user_id);
create index if not exists support_feedback_created_at_idx on public.support_feedback (created_at desc);

alter table public.support_feedback enable row level security;

create policy "support_feedback_insert_own"
  on public.support_feedback for insert
  with check (auth.uid() = user_id);
