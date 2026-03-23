-- DraftReady / 稿定面试 — 初始 schema（在 Supabase SQL Editor 中执行，或 supabase db push）
-- 执行顺序：自上而下整段运行

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  credits_balance integer not null default 100,
  locale text default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. projects（系统模板：user_id IS NULL + is_system_template）
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  resume_text text not null default '',
  jd_text text not null default '',
  analysis_jsonb jsonb,
  rounds_count integer not null default 3,
  active_round integer not null default 1,
  transcript_text text not null default '',
  forked_from_project_id uuid references public.projects (id) on delete set null,
  is_system_template boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_template_or_user check (
    (is_system_template = true and user_id is null)
    or (is_system_template = false and user_id is not null)
  )
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_system_template_idx on public.projects (is_system_template) where is_system_template = true;

alter table public.projects enable row level security;

create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id and is_system_template = false);

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. questions
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  round_index integer not null default 1,
  title text not null,
  source text not null check (source in ('ai', 'user')),
  sort_order integer not null default 0,
  attachment_url text,
  created_at timestamptz not null default now()
);

create index if not exists questions_project_id_idx on public.questions (project_id);

alter table public.questions enable row level security;

create policy "questions_select_via_project"
  on public.questions for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = questions.project_id and p.user_id = auth.uid()
    )
  );

create policy "questions_insert_via_project"
  on public.questions for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = questions.project_id and p.user_id = auth.uid()
    )
  );

create policy "questions_update_via_project"
  on public.questions for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = questions.project_id and p.user_id = auth.uid()
    )
  );

create policy "questions_delete_via_project"
  on public.questions for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = questions.project_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. question_messages
-- ---------------------------------------------------------------------------
create table if not exists public.question_messages (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists question_messages_question_id_idx on public.question_messages (question_id);

alter table public.question_messages enable row level security;

create policy "qm_select_via_question"
  on public.question_messages for select
  using (
    exists (
      select 1 from public.questions q
      join public.projects p on p.id = q.project_id
      where q.id = question_messages.question_id and p.user_id = auth.uid()
    )
  );

create policy "qm_insert_via_question"
  on public.question_messages for insert
  with check (
    exists (
      select 1 from public.questions q
      join public.projects p on p.id = q.project_id
      where q.id = question_messages.question_id and p.user_id = auth.uid()
    )
  );

create policy "qm_update_via_question"
  on public.question_messages for update
  using (
    exists (
      select 1 from public.questions q
      join public.projects p on p.id = q.project_id
      where q.id = question_messages.question_id and p.user_id = auth.uid()
    )
  );

create policy "qm_delete_via_question"
  on public.question_messages for delete
  using (
    exists (
      select 1 from public.questions q
      join public.projects p on p.id = q.project_id
      where q.id = question_messages.question_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. credit_ledger
-- ---------------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_id_idx on public.credit_ledger (user_id);

alter table public.credit_ledger enable row level security;

create policy "credit_ledger_select_own"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. payment_transactions
-- ---------------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  external_id text,
  amount_cents integer,
  currency text not null default 'usd',
  status text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_transactions_user_id_idx on public.payment_transactions (user_id);

alter table public.payment_transactions enable row level security;

create policy "payment_transactions_select_own"
  on public.payment_transactions for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. 积分扣减 RPC（供服务端以用户身份调用，或客户端 RPC）
-- ---------------------------------------------------------------------------
create or replace function public.consume_credits(p_amount integer, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cur integer;
begin
  if p_amount is null or p_amount <= 0 then
    return true;
  end if;
  select credits_balance into cur from public.profiles where id = auth.uid();
  if cur is null or cur < p_amount then
    return false;
  end if;
  update public.profiles
    set credits_balance = credits_balance - p_amount, updated_at = now()
    where id = auth.uid();
  insert into public.credit_ledger (user_id, delta, reason)
    values (auth.uid(), -p_amount, p_reason);
  return true;
end;
$$;

grant execute on function public.consume_credits(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. 从系统模板 fork 到用户（注册触发器调用）
-- ---------------------------------------------------------------------------
create or replace function public.fork_system_template(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl public.projects%rowtype;
  new_project_id uuid;
  q record;
begin
  if exists (select 1 from public.projects where user_id = p_user_id limit 1) then
    select id into new_project_id from public.projects
      where user_id = p_user_id
      order by created_at asc
      limit 1;
    return new_project_id;
  end if;

  select * into tpl from public.projects
    where is_system_template = true
    order by created_at asc
    limit 1;

  if not found then
    return null;
  end if;

  insert into public.projects (
    user_id, resume_text, jd_text, analysis_jsonb, rounds_count, active_round,
    transcript_text, forked_from_project_id, is_system_template, is_archived
  ) values (
    p_user_id, tpl.resume_text, tpl.jd_text, tpl.analysis_jsonb, tpl.rounds_count, 1,
    '', tpl.id, false, false
  )
  returning id into new_project_id;

  for q in
    select * from public.questions where project_id = tpl.id order by sort_order asc, created_at asc
  loop
    insert into public.questions (project_id, round_index, title, source, sort_order, attachment_url)
    values (new_project_id, q.round_index, q.title, q.source, q.sort_order, q.attachment_url);
  end loop;

  return new_project_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. 新用户：profile + fork
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, credits_balance, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    100,
    coalesce(new.raw_user_meta_data->>'locale', 'en')
  )
  on conflict (id) do nothing;

  perform public.fork_system_template(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 10. 系统模板 + 示例题目（仅一条；需 service role 或关闭 RLS 时插入 — 下面用 security definer 函数种子）
-- ---------------------------------------------------------------------------
create or replace function public.seed_system_template_if_missing()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl_id uuid;
begin
  if exists (select 1 from public.projects where is_system_template = true) then
    return;
  end if;

  insert into public.projects (
    user_id, resume_text, jd_text, analysis_jsonb, rounds_count, active_round,
    transcript_text, forked_from_project_id, is_system_template, is_archived
  ) values (
    null,
    $demo_resume$张伟 | 产品经理
手机：138****0000 | 邮箱：zhangwei@example.com

【教育】
· 复旦大学 信息管理与信息系统 本科 2016–2020

【经历】
· ABC 科技（2021–至今）高级产品经理
  - 负责 B 端 SaaS 增长与留存，主导权限与计费模块迭代
  - 用数据漏斗定位 onboarding 流失，推动实验将激活率提升约 18%

【技能】
SQL、Figma、A/B 测试、PRD、跨团队沟通$demo_resume$,
    $demo_jd$高级产品经理 | XYZ 云
我们寻找一位熟悉 B 端 SaaS、具备数据意识的产品经理。

岗位职责：
- 负责核心商业模块（计费、订单、权限）的产品规划与落地
- 与研发紧密合作，拆解需求、定义验收标准并推动上线

任职要求：
- 3 年以上 ToB 产品经验
- 熟练使用数据分析工具，能写基础 SQL 者优先$demo_jd$,
    null,
    3,
    1,
    '',
    null,
    true,
    false
  )
  returning id into tpl_id;

  insert into public.questions (project_id, round_index, title, source, sort_order) values
    (tpl_id, 1, '请做一段简短的自我介绍，并说明你为什么适合这个岗位。', 'ai', 0),
    (tpl_id, 1, '讲一个你推动跨团队达成一致、并最终上线落地的例子。', 'ai', 1),
    (tpl_id, 2, '如果业务方坚持加需求导致排期爆炸，你会怎么处理？', 'ai', 2);
end;
$$;

select public.seed_system_template_if_missing();

-- ---------------------------------------------------------------------------
-- 11. profiles 插入（触发器已建 profile 时 on conflict；允许 service 补全）
-- ---------------------------------------------------------------------------
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 注：handle_new_user 以 security definer 插入 profiles，绕过 RLS
