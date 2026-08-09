-- HQ Operating System V1
-- Applied to production through Supabase MCP on 2026-08-09.
-- Canonical event stream + owner-only HQ notifications, incidents, live snapshot and deterministic rules.

begin;

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid,
  actor_role text,
  school_id uuid,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists platform_events_occurred_at_idx on public.platform_events (occurred_at desc);
create index if not exists platform_events_event_type_idx on public.platform_events (event_type, occurred_at desc);
create index if not exists platform_events_school_idx on public.platform_events (school_id, occurred_at desc) where school_id is not null;
create index if not exists platform_events_entity_idx on public.platform_events (entity_type, entity_id) where entity_id is not null;

create table if not exists public.hq_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.platform_events(id) on delete set null,
  category text not null default 'operations',
  severity text not null default 'info' check (severity in ('info','success','warning','critical')),
  title text not null,
  body text not null default '',
  route text,
  status text not null default 'unread' check (status in ('unread','read','resolved')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz
);
create index if not exists hq_notifications_status_idx on public.hq_notifications (status, created_at desc);
create index if not exists hq_notifications_severity_idx on public.hq_notifications (severity, created_at desc);

create table if not exists public.hq_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_type text not null,
  severity text not null check (severity in ('warning','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  title text not null,
  summary text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  route text,
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);
create index if not exists hq_incidents_open_idx on public.hq_incidents (status, severity, detected_at desc);

alter table public.platform_events enable row level security;
alter table public.hq_notifications enable row level security;
alter table public.hq_incidents enable row level security;
revoke all on public.platform_events from anon, authenticated;
revoke all on public.hq_notifications from anon, authenticated;
revoke all on public.hq_incidents from anon, authenticated;

create or replace function public.hq_emit_event(
  p_event_type text, p_actor_id uuid, p_actor_role text, p_school_id uuid,
  p_entity_type text, p_entity_id uuid, p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_event_id uuid; v_title text; v_body text; v_route text;
  v_category text := 'operations'; v_severity text := 'info'; v_notify boolean := true;
begin
  insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata)
  values (p_event_type,p_actor_id,p_actor_role,p_school_id,p_entity_type,p_entity_id,coalesce(p_metadata,'{}'::jsonb))
  returning id into v_event_id;

  case p_event_type
    when 'user.signup' then v_category:='growth'; v_title:='New signup'; v_body:=coalesce(p_metadata->>'role','User') || case when nullif(p_metadata->>'name','') is not null then ' · '||(p_metadata->>'name') else '' end; v_route:='/hq?view=users';
    when 'school.created' then v_category:='growth'; v_severity:='success'; v_title:='New school registered'; v_body:=coalesce(p_metadata->>'name','A school joined VibeSchool'); v_route:='/hq?view=schools';
    when 'lesson_plan.created' then v_category:='teaching'; v_title:='Lesson plan created'; v_body:=coalesce(p_metadata->>'title','New lesson plan'); v_route:='/hq?view=lesson-plans';
    when 'lesson_plan.published' then v_category:='teaching'; v_severity:='success'; v_title:='Lesson plan published'; v_body:=coalesce(p_metadata->>'title','Lesson plan published'); v_route:='/hq?view=lesson-plans';
    when 'lesson_plan.completed' then v_category:='teaching'; v_notify:=false;
    when 'homework.created' then v_category:='teaching'; v_title:='Homework assigned'; v_body:=coalesce(p_metadata->>'title','New homework'); v_route:='/hq?view=homework';
    when 'homework.submitted' then v_category:='learning'; v_notify:=false;
    when 'publication.created' then v_category:='content'; v_title:='Publication draft created'; v_body:=coalesce(p_metadata->>'title','New publication'); v_route:='/hq?view=content';
    when 'publication.published' then v_category:='content'; v_severity:='success'; v_title:='Publication went live'; v_body:=coalesce(p_metadata->>'title','Publication published'); v_route:='/hq?view=content';
    else v_notify:=false;
  end case;

  if v_notify then
    insert into public.hq_notifications(event_id,category,severity,title,body,route,metadata)
    values (v_event_id,v_category,v_severity,v_title,coalesce(v_body,''),v_route,coalesce(p_metadata,'{}'::jsonb));
  end if;
  return v_event_id;
end;
$$;
revoke all on function public.hq_emit_event(text,uuid,text,uuid,text,uuid,jsonb) from public, anon, authenticated;

create or replace function public.hq_profile_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then perform public.hq_emit_event('user.signup',new.id,coalesce(new.role,'user'),new.school_id,'profile',new.id,jsonb_build_object('role',coalesce(new.role,'user'),'name',coalesce(new.full_name,''))); end if;
  return new;
end; $$;
revoke all on function public.hq_profile_event_trigger() from public, anon, authenticated;
drop trigger if exists trg_hq_profile_event on public.profiles;
create trigger trg_hq_profile_event after insert on public.profiles for each row execute function public.hq_profile_event_trigger();

create or replace function public.hq_school_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then perform public.hq_emit_event('school.created',new.created_by,'admin',new.id,'school',new.id,jsonb_build_object('name',coalesce(new.name,''),'county',coalesce(new.county,''),'status',new.status::text)); end if;
  return new;
end; $$;
revoke all on function public.hq_school_event_trigger() from public, anon, authenticated;
drop trigger if exists trg_hq_school_event on public.schools;
create trigger trg_hq_school_event after insert on public.schools for each row execute function public.hq_school_event_trigger();

create or replace function public.hq_lesson_plan_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare v_event text;
begin
  if tg_op='INSERT' then v_event:='lesson_plan.created';
  elsif old.published_at is null and new.published_at is not null then v_event:='lesson_plan.published';
  elsif old.taught_date is null and new.taught_date is not null then v_event:='lesson_plan.completed';
  else return new; end if;
  perform public.hq_emit_event(v_event,new.teacher_id,'teacher',new.school_id,'lesson_plan',new.id,jsonb_build_object('title',coalesce(new.title,''),'status',coalesce(new.status,''),'term',new.term,'generated_by',coalesce(new.generated_by,'')));
  return new;
end; $$;
revoke all on function public.hq_lesson_plan_event_trigger() from public, anon, authenticated;
drop trigger if exists trg_hq_lesson_plan_event on public.lesson_plans;
create trigger trg_hq_lesson_plan_event after insert or update on public.lesson_plans for each row execute function public.hq_lesson_plan_event_trigger();

create or replace function public.hq_homework_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.hq_emit_event('homework.created',new.teacher_id,'teacher',new.school_id,'homework',new.id,jsonb_build_object('title',coalesce(new.title,''),'subject',coalesce(new.subject,''),'type',coalesce(new.type,''),'due_date',new.due_date));
  return new;
end; $$;
revoke all on function public.hq_homework_event_trigger() from public, anon, authenticated;
drop trigger if exists trg_hq_homework_event on public.homework;
create trigger trg_hq_homework_event after insert on public.homework for each row execute function public.hq_homework_event_trigger();

create or replace function public.hq_homework_submission_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare v_school_id uuid;
begin
  select h.school_id into v_school_id from public.homework h where h.id=new.homework_id;
  perform public.hq_emit_event('homework.submitted',new.student_id,'student',v_school_id,'homework_submission',new.id,jsonb_build_object('homework_id',new.homework_id,'status',coalesce(new.status,'')));
  return new;
end; $$;
revoke all on function public.hq_homework_submission_event_trigger() from public, anon, authenticated;
drop trigger if exists trg_hq_homework_submission_event on public.homework_submissions;
create trigger trg_hq_homework_submission_event after insert on public.homework_submissions for each row execute function public.hq_homework_submission_event_trigger();

create or replace function public.hq_publication_event_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare v_event text;
begin
  if tg_op='INSERT' then v_event:='publication.created';
  elsif coalesce(old.status,'') <> 'published' and new.status='published' then v_event:='publication.published';
  else return new; end if;
  perform public.hq_emit_event(v_event,new.author_id,'author',null,'publication',new.id,jsonb_build_object('title',coalesce(new.title,''),'format',coalesce(new.format,''),'status',coalesce(new.status,''),'cbc_subject',coalesce(new.cbc_subject,''),'cbc_grade',coalesce(new.cbc_grade,'')));
  return new;
end; $$;
revoke all on function public.hq_publication_event_trigger() from public, anon, authenticated;
drop trigger if exists trg_hq_publication_event on public.vibe_publications;
create trigger trg_hq_publication_event after insert or update on public.vibe_publications for each row execute function public.hq_publication_event_trigger();

create or replace function public.hq_assert_owner() returns void language plpgsql security definer set search_path=public as $$
begin if not coalesce(public.is_platform_owner(),false) then raise exception 'HQ access denied' using errcode='42501'; end if; end; $$;
revoke all on function public.hq_assert_owner() from public, anon;
grant execute on function public.hq_assert_owner() to authenticated;

create or replace function public.hq_get_snapshot() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  perform public.hq_assert_owner();
  select jsonb_build_object(
    'generated_at',now(),
    'users',jsonb_build_object('total',(select count(*) from public.profiles where coalesce(is_anonymized,false)=false),'today',(select count(*) from public.profiles where created_at>=date_trunc('day',now())),'teachers',(select count(*) from public.teacher_profiles),'learners',(select count(*) from public.student_profiles)),
    'schools',jsonb_build_object('total',(select count(*) from public.schools where deleted_at is null),'active',(select count(*) from public.schools where deleted_at is null and status::text='active'),'today',(select count(*) from public.schools where deleted_at is null and created_at>=date_trunc('day',now()))),
    'teaching',jsonb_build_object('lesson_plans_today',(select count(*) from public.lesson_plans where created_at>=date_trunc('day',now())),'lesson_plans_7d',(select count(*) from public.lesson_plans where created_at>=now()-interval '7 days'),'lessons_taught_today',(select count(*) from public.lesson_plans where taught_date=current_date),'homework_today',(select count(*) from public.homework where created_at>=date_trunc('day',now())),'submissions_today',(select count(*) from public.homework_submissions where submitted_at>=date_trunc('day',now())),'unreviewed_submissions',(select count(*) from public.homework_submissions where reviewed_at is null)),
    'content',jsonb_build_object('publications_total',(select count(*) from public.vibe_publications),'publications_live',(select count(*) from public.vibe_publications where status='published'),'publications_draft',(select count(*) from public.vibe_publications where status='draft'),'reads_total',(select coalesce(sum(total_reads),0) from public.vibe_publications)),
    'events',jsonb_build_object('today',(select count(*) from public.platform_events where occurred_at>=date_trunc('day',now())),'last_hour',(select count(*) from public.platform_events where occurred_at>=now()-interval '1 hour')),
    'notifications',jsonb_build_object('unread',(select count(*) from public.hq_notifications where status='unread'),'critical',(select count(*) from public.hq_notifications where status<>'resolved' and severity='critical')),
    'incidents',jsonb_build_object('open',(select count(*) from public.hq_incidents where status<>'resolved'))
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.hq_get_snapshot() from public, anon;
grant execute on function public.hq_get_snapshot() to authenticated;

create or replace function public.hq_list_notifications(p_limit integer default 50)
returns table(id uuid,category text,severity text,title text,body text,route text,status text,metadata jsonb,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  perform public.hq_assert_owner();
  return query select n.id,n.category,n.severity,n.title,n.body,n.route,n.status,n.metadata,n.created_at
  from public.hq_notifications n
  order by case n.severity when 'critical' then 0 when 'warning' then 1 else 2 end,n.created_at desc
  limit greatest(1,least(coalesce(p_limit,50),200));
end; $$;
revoke all on function public.hq_list_notifications(integer) from public, anon;
grant execute on function public.hq_list_notifications(integer) to authenticated;

create or replace function public.hq_mark_notification_read(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform public.hq_assert_owner();
  update public.hq_notifications set status=case when status='unread' then 'read' else status end,read_at=coalesce(read_at,now()) where id=p_id;
  return found;
end; $$;
revoke all on function public.hq_mark_notification_read(uuid) from public, anon;
grant execute on function public.hq_mark_notification_read(uuid) to authenticated;

create or replace function public.hq_resolve_notification(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform public.hq_assert_owner();
  update public.hq_notifications set status='resolved',read_at=coalesce(read_at,now()),resolved_at=coalesce(resolved_at,now()) where id=p_id;
  return found;
end; $$;
revoke all on function public.hq_resolve_notification(uuid) from public, anon;
grant execute on function public.hq_resolve_notification(uuid) to authenticated;

create or replace function public.hq_generate_operational_alerts() returns integer language plpgsql security definer set search_path=public as $$
declare v_created integer:=0; v_backlog bigint; v_oldest timestamptz; v_today bigint; v_baseline numeric;
begin
  perform public.hq_assert_owner();
  select count(*),min(submitted_at) into v_backlog,v_oldest from public.homework_submissions where reviewed_at is null;
  if v_backlog>=50 and v_oldest<now()-interval '48 hours' and not exists(select 1 from public.hq_incidents where incident_type='homework_marking_backlog' and status<>'resolved' and detected_at>now()-interval '12 hours') then
    insert into public.hq_incidents(incident_type,severity,title,summary,evidence,route) values('homework_marking_backlog','warning','Homework marking backlog',v_backlog||' submissions are unreviewed; the oldest is more than 48 hours old.',jsonb_build_object('unreviewed',v_backlog,'oldest_submitted_at',v_oldest),'/hq?view=homework');
    insert into public.hq_notifications(category,severity,title,body,route,metadata) values('teaching','warning','Homework marking backlog',v_backlog||' submissions currently await review.','/hq?view=homework',jsonb_build_object('unreviewed',v_backlog,'oldest_submitted_at',v_oldest));
    v_created:=v_created+1;
  end if;
  select count(*) into v_today from public.lesson_plans where created_at>=date_trunc('day',now());
  select avg(day_count)::numeric into v_baseline from (select date(created_at) d,count(*) day_count from public.lesson_plans where created_at>=current_date-interval '28 days' and created_at<current_date and extract(isodow from created_at)=extract(isodow from now()) group by date(created_at)) s;
  if v_baseline is not null and v_baseline>=5 and v_today<v_baseline*0.35 and localtime>=time '12:00' and not exists(select 1 from public.hq_notifications where metadata->>'rule'='lesson_plan_activity_drop' and created_at>=date_trunc('day',now())) then
    insert into public.hq_notifications(category,severity,title,body,route,metadata) values('teaching','warning','Lesson-plan activity unusually low',v_today||' lesson plans today versus a same-weekday baseline of '||round(v_baseline,1)||'.','/hq?view=lesson-plans',jsonb_build_object('rule','lesson_plan_activity_drop','today',v_today,'baseline',round(v_baseline,1)));
    v_created:=v_created+1;
  end if;
  return v_created;
end; $$;
revoke all on function public.hq_generate_operational_alerts() from public, anon;
grant execute on function public.hq_generate_operational_alerts() to authenticated;

commit;
