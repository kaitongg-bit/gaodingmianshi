-- 新用户 fork 的系统模板：列表用友好标题，避免 JD 首行「高级产品经理 | XYZ 云」当标题
update public.projects
set display_title = '模拟练习 · 新手示例'
where is_system_template = true
  and coalesce(trim(display_title), '') = '';

-- 已从系统模板 fork、且尚未自定义标题的用户项目
update public.projects p
set display_title = '模拟练习 · 新手示例'
where user_id is not null
  and coalesce(trim(p.display_title), '') = ''
  and exists (
    select 1
    from public.projects t
    where t.id = p.forked_from_project_id
      and t.is_system_template = true
  );

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
    transcript_text, forked_from_project_id, is_system_template, is_archived,
    display_title
  ) values (
    p_user_id, tpl.resume_text, tpl.jd_text, tpl.analysis_jsonb, tpl.rounds_count, 1,
    '', tpl.id, false, false,
    tpl.display_title
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
