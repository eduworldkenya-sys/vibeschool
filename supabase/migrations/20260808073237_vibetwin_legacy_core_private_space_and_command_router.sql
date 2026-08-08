-- VibeTwin Legacy Core: learner-owned private space and deterministic command router.
-- Production authority applied live. Final router hardening is consolidated in
-- 20260808073314_vibetwin_legacy_core_safe_revision_router.sql.

create table if not exists public.student_twin_private_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('note','question','goal','bookmark','draft','ask_teacher_later','journal')),
  title text,
  body text not null check (length(btrim(body)) > 0),
  subject text,
  topic text,
  tags text[] not null default '{}',
  visibility text not null default 'private' check (visibility in ('private','twin','teacher')),
  status text not null default 'active' check (status in ('active','done','archived')),
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_twin_private_items_profile_updated on public.student_twin_private_items(profile_id, updated_at desc);
create index if not exists idx_student_twin_private_items_profile_type on public.student_twin_private_items(profile_id, item_type, status);
alter table public.student_twin_private_items enable row level security;
revoke all on public.student_twin_private_items from anon, authenticated;

create or replace function public.student_twin_save_private_item(p_item_type text,p_body text,p_title text default null,p_subject text default null,p_topic text default null,p_tags text[] default '{}',p_visibility text default 'private')
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
declare v_uid uuid:=auth.uid(); v_row public.student_twin_private_items;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_item_type not in ('note','question','goal','bookmark','draft','ask_teacher_later','journal') then raise exception 'invalid_item_type'; end if;
  if p_visibility not in ('private','twin','teacher') then raise exception 'invalid_visibility'; end if;
  if btrim(coalesce(p_body,''))='' then raise exception 'body_required'; end if;
  insert into public.student_twin_private_items(profile_id,item_type,title,body,subject,topic,tags,visibility)
  values(v_uid,p_item_type,nullif(btrim(coalesce(p_title,'')),''),btrim(p_body),nullif(btrim(coalesce(p_subject,'')),''),nullif(btrim(coalesce(p_topic,'')),''),coalesce(p_tags,'{}'),p_visibility)
  returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.student_twin_search_private_space(p_query text default null,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
declare v_uid uuid:=auth.uid(); v_query text:=btrim(coalesce(p_query,'')); v_limit integer:=greatest(1,least(coalesce(p_limit,20),50)); v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb) into v_result
  from (
    select id,item_type,title,body,subject,topic,tags,visibility,status,created_at,updated_at
    from public.student_twin_private_items
    where profile_id=v_uid and status<>'archived' and (
      v_query='' or coalesce(title,'') ilike '%'||v_query||'%' or body ilike '%'||v_query||'%' or
      coalesce(subject,'') ilike '%'||v_query||'%' or coalesce(topic,'') ilike '%'||v_query||'%' or
      exists(select 1 from unnest(tags) t where t ilike '%'||v_query||'%')
    ) order by updated_at desc limit v_limit
  ) x;
  return jsonb_build_object('query',v_query,'items',v_result,'authoritative_mastery',false);
end; $$;

revoke all on function public.student_twin_save_private_item(text,text,text,text,text,text[],text) from public, anon;
revoke all on function public.student_twin_search_private_space(text,integer) from public, anon;
grant execute on function public.student_twin_save_private_item(text,text,text,text,text,text[],text) to authenticated;
grant execute on function public.student_twin_search_private_space(text,integer) to authenticated;
