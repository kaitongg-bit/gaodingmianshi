-- 允许用户读取自己提交的反馈（insert 后 .select('id') 需要）
create policy "support_feedback_select_own"
  on public.support_feedback for select
  using (auth.uid() = user_id);

-- 提交反馈后自动赠分（由服务端以 service_role 调用，防刷：24h 内仅一次）
create or replace function public.try_grant_support_feedback_bonus(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_bal integer;
begin
  if p_amount is null or p_amount <= 0 then
    return -1;
  end if;

  if exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id
      and reason = 'support_feedback_bonus'
      and created_at > now() - interval '24 hours'
    limit 1
  ) then
    return -1;
  end if;

  update public.profiles
  set credits_balance = credits_balance + p_amount,
      updated_at = now()
  where id = p_user_id
  returning credits_balance into new_bal;

  if new_bal is null then
    return -1;
  end if;

  insert into public.credit_ledger (user_id, delta, reason)
  values (p_user_id, p_amount, 'support_feedback_bonus');

  return new_bal;
end;
$$;

revoke all on function public.try_grant_support_feedback_bonus(uuid, integer) from public;
grant execute on function public.try_grant_support_feedback_bonus(uuid, integer) to service_role;
