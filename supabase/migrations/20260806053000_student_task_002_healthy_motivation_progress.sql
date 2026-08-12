-- STUDENT-TASK-002 — healthy motivation and progress authority
-- Extends the existing immutable FunHub XP ledger with verified task events,
-- daily goals, learning streaks, achievements, subject progress and mission ranking.

-- Restore the production learner-identity helper required by this migration's RLS policies.
create or replace function public.funhub_get_student_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select id from public.students
  where profile_id = auth.uid() and deleted_at is null
  limit 1;
$function$;
revoke all on function public.funhub_get_student_id() from public,anon;
grant execute on function public.funhub_get_student_id() to authenticated,service_role;

create table if not exists public.student_learning_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null,
  source_type text not null,
  source_id uuid not null,
  subject_id uuid null references public.subjects(id) on delete set null,
  xp_awarded integer not null check (xp_awarded between 0 and 500),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(student_id,event_type,source_type,source_id)
);
alter table public.student_learning_events enable row level security;
drop policy if exists student_learning_events_select_own on public.student_learning_events;
create policy student_learning_events_select_own on public.student_learning_events for select to authenticated using (student_id = public.funhub_get_student_id());
revoke all on public.student_learning_events from anon, public;
grant select on public.student_learning_events to authenticated;

create table if not exists public.student_daily_goals (
  student_id uuid not null references public.students(id) on delete cascade,
  goal_date date not null,
  target_points integer not null check (target_points between 1 and 20),
  completed_points integer not null default 0 check (completed_points >= 0),
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  primary key(student_id,goal_date)
);
alter table public.student_daily_goals enable row level security;
drop policy if exists student_daily_goals_select_own on public.student_daily_goals;
create policy student_daily_goals_select_own on public.student_daily_goals for select to authenticated using (student_id = public.funhub_get_student_id());
revoke all on public.student_daily_goals from anon, public;
grant select on public.student_daily_goals to authenticated;

create table if not exists public.student_learning_streaks (
  student_id uuid primary key references public.students(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_date date null,
  grace_tokens integer not null default 1 check (grace_tokens between 0 and 3),
  updated_at timestamptz not null default now()
);
alter table public.student_learning_streaks enable row level security;
drop policy if exists student_learning_streaks_select_own on public.student_learning_streaks;
create policy student_learning_streaks_select_own on public.student_learning_streaks for select to authenticated using (student_id = public.funhub_get_student_id());
revoke all on public.student_learning_streaks from anon, public;
grant select on public.student_learning_streaks to authenticated;

create table if not exists public.student_achievement_definitions (
  slug text primary key,
  title text not null,
  description text not null,
  icon text not null default '🏅',
  threshold integer not null default 1,
  is_active boolean not null default true
);
insert into public.student_achievement_definitions(slug,title,description,icon,threshold) values
 ('first_task','First Mission','Complete your first verified learning task.','🌟',1),
 ('five_tasks','Mission Builder','Complete five verified learning tasks.','🚀',5),
 ('twenty_tasks','Focused Learner','Complete twenty verified learning tasks.','🎯',20),
 ('three_day_streak','Three Strong Days','Learn meaningfully for three consecutive days.','🔥',3),
 ('seven_day_streak','Seven-Day Momentum','Learn meaningfully for seven consecutive days.','🏆',7)
on conflict (slug) do update set title=excluded.title,description=excluded.description,icon=excluded.icon,threshold=excluded.threshold,is_active=true;
alter table public.student_achievement_definitions enable row level security;
drop policy if exists student_achievement_definitions_read on public.student_achievement_definitions;
create policy student_achievement_definitions_read on public.student_achievement_definitions for select to authenticated using (is_active = true);
revoke all on public.student_achievement_definitions from anon, public;
grant select on public.student_achievement_definitions to authenticated;

create table if not exists public.student_achievement_awards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  achievement_slug text not null references public.student_achievement_definitions(slug),
  awarded_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  unique(student_id,achievement_slug)
);
alter table public.student_achievement_awards enable row level security;
drop policy if exists student_achievement_awards_select_own on public.student_achievement_awards;
create policy student_achievement_awards_select_own on public.student_achievement_awards for select to authenticated using (student_id = public.funhub_get_student_id());
revoke all on public.student_achievement_awards from anon, public;
grant select on public.student_achievement_awards to authenticated;

create table if not exists public.student_subject_progress (
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  completed_tasks integer not null default 0,
  total_tasks integer not null default 0,
  average_score numeric null,
  mastery_percentage numeric null,
  updated_at timestamptz not null default now(),
  primary key(student_id,subject_id)
);
alter table public.student_subject_progress enable row level security;
drop policy if exists student_subject_progress_select_own on public.student_subject_progress;
create policy student_subject_progress_select_own on public.student_subject_progress for select to authenticated using (student_id = public.funhub_get_student_id());
revoke all on public.student_subject_progress from anon, public;
grant select on public.student_subject_progress to authenticated;

create or replace function public.student_refresh_motivation_summary()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller uuid:=auth.uid(); learner public.students%rowtype; today_date date:=current_date;
  completed_today integer:=0; target integer:=3; streak_row public.student_learning_streaks%rowtype;
  total_events integer:=0; achievements jsonb:='[]'::jsonb; subjects jsonb:='[]'::jsonb; next_task jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into learner from public.students where profile_id=caller and deleted_at is null limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;
  select count(*) into completed_today from public.student_learning_events where student_id=learner.id and occurred_at::date=today_date;
  target:=greatest(1,least(5,coalesce((select count(*) from jsonb_array_elements(coalesce((public.student_list_my_tasks()->'tasks'),'[]'::jsonb)) t where coalesce(t->>'status','') in ('ready','in_progress','overdue')),0)));
  insert into public.student_daily_goals(student_id,goal_date,target_points,completed_points,completed_at)
  values(learner.id,today_date,target,completed_today,case when completed_today>=target then now() end)
  on conflict(student_id,goal_date) do update set target_points=excluded.target_points,completed_points=excluded.completed_points,completed_at=case when excluded.completed_points>=excluded.target_points then coalesce(public.student_daily_goals.completed_at,now()) else null end,updated_at=now();
  insert into public.student_learning_streaks(student_id,current_streak,longest_streak,last_active_date)
  values(learner.id,case when completed_today>0 then 1 else 0 end,case when completed_today>0 then 1 else 0 end,case when completed_today>0 then today_date end)
  on conflict(student_id) do nothing;
  select * into streak_row from public.student_learning_streaks where student_id=learner.id;
  select count(*) into total_events from public.student_learning_events where student_id=learner.id;
  insert into public.student_achievement_awards(student_id,achievement_slug,evidence)
  select learner.id,d.slug,jsonb_build_object('count',total_events) from public.student_achievement_definitions d
  where d.is_active and ((d.slug='first_task' and total_events>=1) or (d.slug='five_tasks' and total_events>=5) or (d.slug='twenty_tasks' and total_events>=20) or (d.slug='three_day_streak' and streak_row.current_streak>=3) or (d.slug='seven_day_streak' and streak_row.current_streak>=7)) on conflict do nothing;
  select coalesce(jsonb_agg(jsonb_build_object('slug',a.achievement_slug,'title',d.title,'description',d.description,'icon',d.icon,'awarded_at',a.awarded_at) order by a.awarded_at desc),'[]'::jsonb)
  into achievements from public.student_achievement_awards a join public.student_achievement_definitions d on d.slug=a.achievement_slug where a.student_id=learner.id;
  select coalesce(jsonb_agg(jsonb_build_object('subject_id',p.subject_id,'subject_name',s.name,'completed_tasks',p.completed_tasks,'total_tasks',p.total_tasks,'average_score',p.average_score,'mastery_percentage',p.mastery_percentage) order by s.name),'[]'::jsonb)
  into subjects from public.student_subject_progress p join public.subjects s on s.id=p.subject_id where p.student_id=learner.id;
  select value into next_task from jsonb_array_elements(coalesce((public.student_list_my_tasks()->'tasks'),'[]'::jsonb)) value
  where coalesce(value->>'status','') in ('overdue','in_progress','ready','upcoming')
  order by case value->>'status' when 'overdue' then 0 when 'in_progress' then 1 when 'ready' then 2 else 3 end, nullif(value->>'due_at','')::timestamptz nulls last limit 1;
  return jsonb_build_object('ok',true,'student_id',learner.id,'daily_goal',jsonb_build_object('date',today_date,'target',target,'completed',completed_today,'complete',completed_today>=target),'streak',jsonb_build_object('current',streak_row.current_streak,'longest',streak_row.longest_streak,'grace_tokens',streak_row.grace_tokens),'total_xp',coalesce((select sum(amount) from public.funhub_xp_ledger where student_id=learner.id),0),'achievements',achievements,'subject_progress',subjects,'next_mission',next_task);
end;
$$;
revoke all on function public.student_refresh_motivation_summary() from public,anon;
grant execute on function public.student_refresh_motivation_summary() to authenticated;

create or replace function public.student_record_verified_task_completion(p_source_type text,p_source_id uuid,p_subject_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); learner public.students%rowtype; xp integer:=20; inserted_id uuid; prev_date date; new_streak integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into learner from public.students where profile_id=caller and deleted_at is null limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;
  if p_source_type not in ('homework','exercise','project','assessment','revision') then raise exception 'unsupported_source_type'; end if;
  if p_source_type='homework' and not exists(select 1 from public.homework_submissions hs where hs.homework_id=p_source_id and hs.student_id=learner.id and hs.status in ('submitted','marked')) then raise exception 'completion_not_verified'; end if;
  if p_source_type='exercise' and not exists(select 1 from public.exercise_submissions es where es.exercise_id=p_source_id and es.student_id=learner.id and es.status in ('submitted','marked')) then raise exception 'completion_not_verified'; end if;
  if p_source_type='project' and not exists(select 1 from public.project_submissions ps where ps.project_id=p_source_id and ps.student_id=learner.id and ps.status in ('submitted','marked')) then raise exception 'completion_not_verified'; end if;
  if p_source_type='assessment' and not exists(select 1 from public.assessment_attempts aa where aa.assignment_id=p_source_id and aa.student_id=learner.id and aa.status in ('submitted','marked','released')) then raise exception 'completion_not_verified'; end if;
  insert into public.student_learning_events(student_id,event_type,source_type,source_id,subject_id,xp_awarded)
  values(learner.id,'task_completed',p_source_type,p_source_id,p_subject_id,xp) on conflict do nothing returning id into inserted_id;
  if inserted_id is null then return public.student_refresh_motivation_summary() || jsonb_build_object('awarded',false,'xp_awarded',0); end if;
  insert into public.funhub_xp_ledger(student_id,amount,source,reference_id) values(learner.id,xp,'verified_task',inserted_id);
  select last_active_date into prev_date from public.student_learning_streaks where student_id=learner.id;
  new_streak:=case when prev_date=current_date then coalesce((select current_streak from public.student_learning_streaks where student_id=learner.id),1) when prev_date=current_date-1 then coalesce((select current_streak from public.student_learning_streaks where student_id=learner.id),0)+1 else 1 end;
  insert into public.student_learning_streaks(student_id,current_streak,longest_streak,last_active_date)
  values(learner.id,new_streak,new_streak,current_date)
  on conflict(student_id) do update set current_streak=new_streak,longest_streak=greatest(public.student_learning_streaks.longest_streak,new_streak),last_active_date=current_date,updated_at=now();
  return public.student_refresh_motivation_summary() || jsonb_build_object('awarded',true,'xp_awarded',xp);
end;
$$;
revoke all on function public.student_record_verified_task_completion(text,uuid,uuid) from public,anon;
grant execute on function public.student_record_verified_task_completion(text,uuid,uuid) to authenticated;
