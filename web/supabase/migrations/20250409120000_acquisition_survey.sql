-- 用户来源问卷（完成一次 +20 积分，幂等）

create table if not exists public.user_acquisition_survey (
  user_id uuid primary key references auth.users (id) on delete cascade,
  channel text not null,
  other_detail text,
  created_at timestamptz not null default now()
);

create index if not exists user_acquisition_survey_channel_idx
  on public.user_acquisition_survey (channel);

alter table public.user_acquisition_survey enable row level security;

create policy "user_acquisition_survey_select_own"
  on public.user_acquisition_survey for select
  using (auth.uid() = user_id);

-- 插入仅通过 security definer 函数，避免绕过赠分逻辑

create or replace function public.complete_acquisition_survey(p_channel text, p_other_detail text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_bal integer;
  ch text;
  other text;
  bonus integer := 20;
begin
  if uid is null then
    return -1;
  end if;

  ch := lower(trim(coalesce(p_channel, '')));
  if ch not in ('tiktok', 'wechat', 'xiaohongshu', 'reddit', 'other') then
    return -1;
  end if;

  other := nullif(trim(coalesce(p_other_detail, '')), '');
  if ch = 'other' then
    if other is null or length(other) > 500 then
      return -1;
    end if;
  else
    other := null;
  end if;

  if exists (select 1 from public.user_acquisition_survey where user_id = uid) then
    return -2;
  end if;

  insert into public.user_acquisition_survey (user_id, channel, other_detail)
  values (uid, ch, other);

  update public.profiles
  set credits_balance = credits_balance + bonus,
      updated_at = now()
  where id = uid
  returning credits_balance into new_bal;

  if new_bal is null then
    raise exception 'profile_not_found_for_acquisition_survey';
  end if;

  insert into public.credit_ledger (user_id, delta, reason)
  values (uid, bonus, 'acquisition_survey_bonus');

  return new_bal;
end;
$$;

revoke all on function public.complete_acquisition_survey(text, text) from public;
grant execute on function public.complete_acquisition_survey(text, text) to authenticated;
