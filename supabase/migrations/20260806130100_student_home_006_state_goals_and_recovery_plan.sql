create table if not exists public.student_home_state (
  student_id uuid primary key references public.students(id) on delete cascade,
  last_opened_at timestamptz,
  changes_seen_through timestamptz,
  kcse_target_grade text,
  weekly_study_minutes integer not null default 300 check (weekly_study_minutes between 30 and 4200),
  preferred_session_minutes integer not null default 25 check (preferred_session_minutes between 10 and 180),
  preferred_study_time text not null default 'evening' check (preferred_study_time in ('morning','afternoon','evening','flexible')),
  subject_targets jsonb not null default '{}'::jsonb check (jsonb_typeof(subject_targets) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_home_state enable row level security;

create policy "student_home_state_select_own"
on public.student_home_state for select
to authenticated
using (exists (
  select 1 from public.students s
  where s.id = student_home_state.student_id
    and s.profile_id = auth.uid()
    and s.deleted_at is null
));

create policy "student_home_state_insert_own"
on public.student_home_state for insert
to authenticated
with check (exists (
  select 1 from public.students s
  where s.id = student_home_state.student_id
    and s.profile_id = auth.uid()
    and s.deleted_at is null
));

create policy "student_home_state_update_own"
on public.student_home_state for update
to authenticated
using (exists (
  select 1 from public.students s
  where s.id = student_home_state.student_id
    and s.profile_id = auth.uid()
    and s.deleted_at is null
))
with check (exists (
  select 1 from public.students s
  where s.id = student_home_state.student_id
    and s.profile_id = auth.uid()
    and s.deleted_at is null
));

-- Restore the production RPCs owned by this migration before applying execution grants.
create or replace function public.student_mark_home_opened()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare caller uuid:=auth.uid(); learner_id uuid; stamp timestamptz:=now();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select id into learner_id from public.students where profile_id=caller and deleted_at is null limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;
  insert into public.student_home_state(student_id,last_opened_at)
  values(learner_id,stamp)
  on conflict(student_id) do update set last_opened_at=excluded.last_opened_at,updated_at=now();
  return jsonb_build_object('ok',true,'last_opened_at',stamp);
end;
$function$;

create or replace function public.student_acknowledge_home_changes()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare caller uuid:=auth.uid(); learner_id uuid; stamp timestamptz:=now();
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select id into learner_id from public.students where profile_id=caller and deleted_at is null limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;
  insert into public.student_home_state(student_id,changes_seen_through,last_opened_at)
  values(learner_id,stamp,stamp)
  on conflict(student_id) do update set changes_seen_through=excluded.changes_seen_through,last_opened_at=excluded.last_opened_at,updated_at=now();
  return jsonb_build_object('ok',true,'changes_seen_through',stamp);
end;
$function$;

create or replace function public.student_update_home_preferences(
  p_kcse_target_grade text default null,
  p_weekly_study_minutes integer default null,
  p_preferred_session_minutes integer default null,
  p_preferred_study_time text default null,
  p_subject_targets jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare caller uuid:=auth.uid(); learner_id uuid; current_state public.student_home_state%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select id into learner_id from public.students where profile_id=caller and deleted_at is null limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;
  if p_weekly_study_minutes is not null and (p_weekly_study_minutes<30 or p_weekly_study_minutes>4200) then raise exception 'invalid_weekly_study_minutes'; end if;
  if p_preferred_session_minutes is not null and (p_preferred_session_minutes<10 or p_preferred_session_minutes>180) then raise exception 'invalid_session_minutes'; end if;
  if p_preferred_study_time is not null and p_preferred_study_time not in ('morning','afternoon','evening','flexible') then raise exception 'invalid_preferred_study_time'; end if;
  if p_subject_targets is not null and jsonb_typeof(p_subject_targets)<>'object' then raise exception 'invalid_subject_targets'; end if;

  insert into public.student_home_state(student_id) values(learner_id) on conflict(student_id) do nothing;
  update public.student_home_state set
    kcse_target_grade=coalesce(p_kcse_target_grade,kcse_target_grade),
    weekly_study_minutes=coalesce(p_weekly_study_minutes,weekly_study_minutes),
    preferred_session_minutes=coalesce(p_preferred_session_minutes,preferred_session_minutes),
    preferred_study_time=coalesce(p_preferred_study_time,preferred_study_time),
    subject_targets=coalesce(p_subject_targets,subject_targets),
    updated_at=now()
  where student_id=learner_id
  returning * into current_state;

  return jsonb_build_object('ok',true,'targets',jsonb_build_object(
    'kcse_target_grade',current_state.kcse_target_grade,
    'subject_targets',current_state.subject_targets,
    'weekly_study_minutes',current_state.weekly_study_minutes,
    'preferred_session_minutes',current_state.preferred_session_minutes,
    'preferred_study_time',current_state.preferred_study_time
  ));
end;
$function$;

revoke all on function public.student_get_home_os_brief() from public, anon;
revoke all on function public.student_mark_home_opened() from public, anon;
revoke all on function public.student_acknowledge_home_changes() from public, anon;
revoke all on function public.student_update_home_preferences(text,integer,integer,text,jsonb) from public, anon;
grant execute on function public.student_get_home_os_brief() to authenticated;
grant execute on function public.student_mark_home_opened() to authenticated;
grant execute on function public.student_acknowledge_home_changes() to authenticated;
grant execute on function public.student_update_home_preferences(text,integer,integer,text,jsonb) to authenticated;
