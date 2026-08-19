-- VibeSchool Task 5: authoritative learner notification events.
-- Notifications are emitted from assignment/result transitions, deduplicated per
-- learner + event type + source identity, and reopen when feedback/result changes.

-- Production already has notifications with a narrower legacy type check. Widen
-- that existing contract before any new learner event can be emitted; clean
-- rebuilds receive the same check from the prerequisite migration immediately
-- before this file.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'fee_payment'::text,
    'fee_reminder'::text,
    'attendance'::text,
    'announcement'::text,
    'leave'::text,
    'general'::text,
    'homework_submitted'::text,
    'homework_assigned'::text,
    'assessment_available'::text,
    'homework_feedback'::text,
    'assessment_result'::text
  ])
);

create unique index if not exists notifications_active_event_uniq
  on public.notifications(user_id,type,related_id)
  where deleted_at is null and related_id is not null;

create or replace function public.task5_upsert_student_notification(
  p_school_id uuid,
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_related_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null or p_related_id is null then return; end if;
  insert into public.notifications(school_id,user_id,title,body,type,related_id,is_read,deleted_at)
  values(p_school_id,p_user_id,p_title,p_body,p_type,p_related_id,false,null)
  on conflict (user_id,type,related_id)
    where deleted_at is null and related_id is not null
  do update set
    school_id=excluded.school_id,
    title=excluded.title,
    body=excluded.body,
    is_read=false,
    created_at=now();
end;
$$;

revoke all on function public.task5_upsert_student_notification(uuid,uuid,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.task5_upsert_student_notification(uuid,uuid,text,text,text,uuid)
  to service_role;

create or replace function public.task5_notify_homework_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select s.profile_id
    from public.student_classes sc
    join public.students s on s.id=sc.student_id and s.deleted_at is null
    where sc.class_id=new.class_id
      and sc.school_id=new.school_id
      and sc.is_current=true
      and s.profile_id is not null
      and (
        new.target_group_id is null
        or exists(
          select 1 from public.class_group_members cgm
          where cgm.group_id=new.target_group_id and cgm.student_id=s.id
        )
      )
  loop
    perform public.task5_upsert_student_notification(
      new.school_id,
      r.profile_id,
      coalesce(nullif(btrim(new.title),''),'New homework'),
      case when new.due_date is null
        then 'New homework has been assigned to your class.'
        else 'New homework has been assigned. Due '||to_char(new.due_date,'DD Mon YYYY')||'.'
      end,
      'homework_assigned',
      new.id
    );
  end loop;
  return new;
end;
$$;

revoke all on function public.task5_notify_homework_assignment() from public, anon, authenticated;

drop trigger if exists task5_homework_assignment_notification on public.homework;
create trigger task5_homework_assignment_notification
after insert on public.homework
for each row execute function public.task5_notify_homework_assignment();

create or replace function public.task5_notify_assessment_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_title text;
begin
  if new.status not in ('assigned','open') then return new; end if;
  select ad.title into v_title from public.assessment_definitions ad where ad.id=new.assessment_id;
  for r in
    select s.profile_id
    from public.student_classes sc
    join public.students s on s.id=sc.student_id and s.deleted_at is null
    where sc.class_id=new.class_id
      and sc.school_id=new.school_id
      and sc.is_current=true
      and s.profile_id is not null
      and (
        new.target_group_id is null
        or exists(
          select 1 from public.class_group_members cgm
          where cgm.group_id=new.target_group_id and cgm.student_id=s.id
        )
      )
  loop
    perform public.task5_upsert_student_notification(
      new.school_id,
      r.profile_id,
      coalesce(nullif(btrim(v_title),''),'Assessment available'),
      case when new.closes_at is null
        then 'A new assessment is ready for you.'
        else 'A new assessment is ready. Complete it before '||to_char(new.closes_at at time zone 'Africa/Nairobi','DD Mon HH24:MI')||'.'
      end,
      'assessment_available',
      new.id
    );
  end loop;
  return new;
end;
$$;

revoke all on function public.task5_notify_assessment_assignment() from public, anon, authenticated;

drop trigger if exists task5_assessment_assignment_notification on public.assessment_assignments;
create trigger task5_assessment_assignment_notification
after insert or update of status,opens_at,closes_at on public.assessment_assignments
for each row
when (new.status in ('assigned','open'))
execute function public.task5_notify_assessment_assignment();

create or replace function public.task5_notify_homework_feedback()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_school_id uuid;
  v_title text;
begin
  if new.status <> 'marked' and new.mark is null then return new; end if;
  if tg_op='UPDATE'
     and old.status is not distinct from new.status
     and old.mark is not distinct from new.mark
     and old.feedback is not distinct from new.feedback then
    return new;
  end if;

  select s.profile_id,h.school_id,h.title
  into v_profile_id,v_school_id,v_title
  from public.students s
  join public.homework h on h.id=new.homework_id
  where s.id=new.student_id and s.deleted_at is null;

  perform public.task5_upsert_student_notification(
    v_school_id,
    v_profile_id,
    'Homework feedback ready',
    case when nullif(btrim(coalesce(new.feedback,'')),'') is null
      then coalesce(nullif(btrim(v_title),''),'Your homework')||' has been marked.'
      else coalesce(nullif(btrim(v_title),''),'Your homework')||' has new teacher feedback.'
    end,
    'homework_feedback',
    new.homework_id
  );
  return new;
end;
$$;

revoke all on function public.task5_notify_homework_feedback() from public, anon, authenticated;

drop trigger if exists task5_homework_feedback_notification on public.homework_submissions;
create trigger task5_homework_feedback_notification
after insert or update of status,mark,feedback on public.homework_submissions
for each row execute function public.task5_notify_homework_feedback();

create or replace function public.task5_notify_assessment_result()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_title text;
begin
  if new.result_status <> 'released' then return new; end if;
  if tg_op='UPDATE' and old.result_status='released'
     and old.score is not distinct from new.score
     and old.feedback is not distinct from new.feedback then
    return new;
  end if;

  select s.profile_id,ad.title
  into v_profile_id,v_title
  from public.students s
  join public.assessment_definitions ad on ad.id=new.assessment_id
  where s.id=new.student_id and s.deleted_at is null;

  perform public.task5_upsert_student_notification(
    new.school_id,
    v_profile_id,
    'Assessment result ready',
    coalesce(nullif(btrim(v_title),''),'Your assessment')||' result is now available.',
    'assessment_result',
    new.assignment_id
  );
  return new;
end;
$$;

revoke all on function public.task5_notify_assessment_result() from public, anon, authenticated;

drop trigger if exists task5_assessment_result_notification on public.assessment_attempts;
create trigger task5_assessment_result_notification
after insert or update of result_status,score,feedback on public.assessment_attempts
for each row execute function public.task5_notify_assessment_result();
