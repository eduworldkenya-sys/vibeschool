-- P0 emergency school closure: one canonical calendar exception, auditable
-- occurrence interruption, reversible reopening and fail-closed teaching.
-- Does not rewrite the timetable, scheme or existing completed teaching.
-- authorization-test: school admins only may preview/record/reopen disruptions;
-- school members may read an append-only audit; anon and other schools denied.
begin;

alter table public.school_calendar_exceptions
  add column if not exists disruption_reason_code text,
  add column if not exists disruption_details text;

alter table public.school_calendar_exceptions
  drop constraint if exists school_calendar_exception_disruption_code_check;
alter table public.school_calendar_exceptions
  add constraint school_calendar_exception_disruption_code_check
  check (disruption_reason_code is null or disruption_reason_code in (
    'demonstrations','weather','strike','insecurity','health','other'
  ));

alter table public.teaching_occurrences
  add column if not exists disruption_exception_id uuid
    references public.school_calendar_exceptions(id) on delete set null,
  add column if not exists disruption_previous_lifecycle text,
  add column if not exists disruption_previous_reason text;

alter table public.teaching_occurrences
  drop constraint if exists teaching_occurrences_disruption_previous_check;
alter table public.teaching_occurrences
  add constraint teaching_occurrences_disruption_previous_check
  check (disruption_previous_lifecycle is null or
    disruption_previous_lifecycle in ('planned','ready'));

create index if not exists teaching_occurrences_disruption_exception_idx
  on public.teaching_occurrences(disruption_exception_id)
  where disruption_exception_id is not null;

create table if not exists public.school_disruption_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  calendar_exception_id uuid not null references public.school_calendar_exceptions(id) on delete restrict,
  action text not null check (action in ('recorded','reopened')),
  reason_code text not null,
  explanation text,
  affected_occurrences integer not null default 0 check (affected_occurrences >= 0),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists school_disruption_audit_school_date_idx
  on public.school_disruption_audit(school_id, created_at desc);
alter table public.school_disruption_audit enable row level security;
revoke all on public.school_disruption_audit from public, anon, authenticated;
grant select on public.school_disruption_audit to authenticated;
grant all on public.school_disruption_audit to service_role;
create policy school_disruption_audit_member_read
  on public.school_disruption_audit for select to authenticated
  using (public.is_active_school_member(school_id) or public.is_school_admin(school_id));

-- A preview is read-only and school-scoped. It counts actual dated slots,
-- not arbitrary weekday totals; the caller must confirm the current preview.
create or replace function public.admin_preview_school_disruption(
  p_school_id uuid, p_date date
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_scheduled integer;
  v_completed integer;
  v_in_progress integer;
  v_existing uuid;
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then
    raise exception 'SCHOOL_ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_date is null then raise exception 'DATE_REQUIRED'; end if;
  if not exists (
    select 1 from public.academic_terms t
    where t.school_id=p_school_id and p_date between t.start_date and t.end_date
  ) then raise exception 'DATE_OUTSIDE_SCHOOL_TERM'; end if;
  select count(*) into v_scheduled from public.timetable_slots s
  where s.school_id=p_school_id
    and s.day_of_week=extract(isodow from p_date)::int
    and s.effective_from<=p_date
    and (s.effective_until is null or s.effective_until>=p_date)
    and s.recurrence_pattern='EVERY_WEEK';
  select count(*) filter (where o.lifecycle='completed'),
         count(*) filter (where o.lifecycle='in_progress')
    into v_completed,v_in_progress
    from public.teaching_occurrences o
   where o.school_id=p_school_id and o.occurrence_date=p_date;
  select ce.id into v_existing
    from public.school_calendar_exceptions ce
   where ce.school_id=p_school_id and ce.exception_date=p_date
     and ce.suppress_ordinary_teaching
   limit 1;
  return jsonb_build_object(
    'school_id',p_school_id,'date',p_date,
    'scheduled_slots',v_scheduled,
    'completed_lessons_preserved',v_completed,
    'lessons_in_progress',v_in_progress,
    'already_closed',v_existing is not null,
    'can_confirm',v_in_progress=0 and v_existing is null
  );
end;
$function$;

-- Atomic, idempotent full-day closure. The existing school calendar and
-- teaching-occurrence records remain the only scheduling authorities.
create or replace function public.admin_record_school_disruption(
  p_school_id uuid, p_date date, p_reason_code text, p_details text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_ce public.school_calendar_exceptions;
  v_existing_count integer;
  v_active_count integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_reason text := nullif(btrim(coalesce(p_details,'')),'');
begin
  if v_uid is null or not public.is_school_admin(p_school_id) then
    raise exception 'SCHOOL_ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_date is null or p_date < v_today-90 or p_date > v_today+366 then
    raise exception 'DISRUPTION_DATE_OUT_OF_RANGE';
  end if;
  if p_reason_code is null or p_reason_code not in
    ('demonstrations','weather','strike','insecurity','health','other') then
    raise exception 'INVALID_DISRUPTION_REASON';
  end if;
  if length(coalesce(p_details,''))>2000 then raise exception 'DETAILS_TOO_LONG'; end if;
  if not exists (
    select 1 from public.academic_terms t
    where t.school_id=p_school_id and p_date between t.start_date and t.end_date
  ) then raise exception 'DATE_OUTSIDE_SCHOOL_TERM'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('school-disruption:'||p_school_id::text||':'||p_date::text,0)
  );
  select count(*) into v_existing_count
    from public.school_calendar_exceptions ce
   where ce.school_id=p_school_id and ce.exception_date=p_date and ce.kind='closure';
  if v_existing_count>1 then raise exception 'AMBIGUOUS_SCHOOL_CLOSURE'; end if;

  if exists (
    select 1 from public.school_calendar_exceptions ce
    where ce.school_id=p_school_id and ce.exception_date=p_date
      and ce.kind<>'closure' and ce.suppress_ordinary_teaching
  ) then raise exception 'DAY_ALREADY_SUPPRESSED_BY_OTHER_CALENDAR_EVENT'; end if;

  select * into v_ce from public.school_calendar_exceptions ce
   where ce.school_id=p_school_id and ce.exception_date=p_date and ce.kind='closure'
   for update;
  if found and v_ce.suppress_ordinary_teaching then
    if v_ce.disruption_reason_code is null then
      raise exception 'DAY_ALREADY_CLOSED_BY_ANOTHER_PROCESS';
    end if;
    if v_ce.disruption_reason_code<>p_reason_code
       or v_ce.disruption_details is distinct from v_reason then
      raise exception 'DISRUPTION_ALREADY_RECORDED_WITH_DIFFERENT_DETAILS';
    end if;
    return jsonb_build_object('status','already_recorded',
      'calendar_exception_id',v_ce.id,'affected_occurrences',0);
  end if;

  select count(*) into v_active_count from public.teaching_occurrences o
   where o.school_id=p_school_id and o.occurrence_date=p_date
     and o.lifecycle='in_progress';
  if v_active_count>0 then raise exception 'LESSONS_ALREADY_IN_PROGRESS'; end if;

  if v_ce.id is null then
    insert into public.school_calendar_exceptions(
      school_id,exception_date,kind,label,suppress_ordinary_teaching,
      disruption_reason_code,disruption_details,created_by
    ) values (
      p_school_id,p_date,'closure','School closure: '||p_reason_code,true,
      p_reason_code,v_reason,v_uid
    ) returning * into v_ce;
  else
    update public.school_calendar_exceptions
       set suppress_ordinary_teaching=true,
           label='School closure: '||p_reason_code,
           disruption_reason_code=p_reason_code,disruption_details=v_reason
     where id=v_ce.id returning * into v_ce;
  end if;

  -- Create a missed record for eligible slots that have never been
  -- materialized. Completed and pre-existing missed lessons are untouched.
  insert into public.teaching_occurrences (
    timetable_slot_id,occurrence_date,school_id,teacher_id,class_id,subject_id,
    lifecycle,exception_reason,disruption_exception_id
  )
  select s.id,p_date,s.school_id,s.teacher_id,s.class_id,s.subject_id,
    'missed','School disruption: '||p_reason_code,v_ce.id
  from public.timetable_slots s
  where s.school_id=p_school_id
    and s.day_of_week=extract(isodow from p_date)::int
    and s.effective_from<=p_date
    and (s.effective_until is null or s.effective_until>=p_date)
    and s.recurrence_pattern='EVERY_WEEK'
  on conflict (timetable_slot_id,occurrence_date) do nothing;
  get diagnostics v_inserted = row_count;

  update public.teaching_occurrences o
     set lifecycle='missed',disruption_exception_id=v_ce.id,
         disruption_previous_lifecycle=o.lifecycle,
         disruption_previous_reason=o.exception_reason,
         exception_reason='School disruption: '||p_reason_code
   where o.school_id=p_school_id and o.occurrence_date=p_date
     and o.lifecycle in ('planned','ready') and o.disruption_exception_id is null;
  get diagnostics v_updated = row_count;

  insert into public.school_disruption_audit (
    school_id,calendar_exception_id,action,reason_code,explanation,
    affected_occurrences,actor_id
  ) values (p_school_id,v_ce.id,'recorded',p_reason_code,v_reason,
            v_inserted+v_updated,v_uid);
  return jsonb_build_object('status','recorded',
    'calendar_exception_id',v_ce.id,'affected_occurrences',v_inserted+v_updated);
end;
$function$;

-- Reopening retains the exception and both audit events; lesson histories
-- are never deleted. Past unrecovered lessons stay missed.
create or replace function public.admin_reopen_school_disruption(
  p_calendar_exception_id uuid, p_explanation text
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_ce public.school_calendar_exceptions;
  v_school_id uuid;
  v_date date;
  v_count integer := 0;
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
begin
  select school_id,exception_date into v_school_id,v_date
    from public.school_calendar_exceptions where id=p_calendar_exception_id;
  if v_school_id is null then raise exception 'DISRUPTION_NOT_FOUND'; end if;
  if v_uid is null or not public.is_school_admin(v_school_id) then
    raise exception 'SCHOOL_ADMIN_REQUIRED' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('school-disruption:'||v_school_id::text||':'||v_date::text,0)
  );
  select * into v_ce from public.school_calendar_exceptions
   where id=p_calendar_exception_id for update;
  if v_ce.id is null then raise exception 'DISRUPTION_NOT_FOUND'; end if;
  if v_ce.kind<>'closure' or v_ce.disruption_reason_code is null then
    raise exception 'NOT_A_MANAGED_DISRUPTION';
  end if;
  if nullif(btrim(coalesce(p_explanation,'')),'') is null then
    raise exception 'REOPENING_REASON_REQUIRED';
  end if;
  if length(p_explanation)>2000 then raise exception 'DETAILS_TOO_LONG'; end if;
  if not v_ce.suppress_ordinary_teaching then
    return jsonb_build_object('status','already_reopened',
      'calendar_exception_id',v_ce.id,'restored_occurrences',0);
  end if;
  if exists (
    select 1 from public.school_calendar_exceptions ce
    where ce.school_id=v_ce.school_id and ce.exception_date=v_ce.exception_date
      and ce.id<>v_ce.id and ce.suppress_ordinary_teaching
  ) then raise exception 'OTHER_CALENDAR_CLOSURE_REMAINS'; end if;

  -- Do not reverse a day while teaching is in progress.
  if exists (select 1 from public.teaching_occurrences o
             where o.disruption_exception_id=v_ce.id
               and o.lifecycle='in_progress') then
    raise exception 'LESSONS_ALREADY_IN_PROGRESS';
  end if;
  update public.teaching_occurrences o
     set lifecycle=case when o.occurrence_date<v_today then 'missed'
         else coalesce(o.disruption_previous_lifecycle,'planned') end,
         exception_reason=case when o.occurrence_date<v_today
           then o.exception_reason else o.disruption_previous_reason end,
         disruption_exception_id=null,disruption_previous_lifecycle=null,
         disruption_previous_reason=null
   where o.disruption_exception_id=v_ce.id and o.lifecycle='missed';
  get diagnostics v_count=row_count;

  update public.school_calendar_exceptions
     set suppress_ordinary_teaching=false
   where id=v_ce.id;
  insert into public.school_disruption_audit(
    school_id,calendar_exception_id,action,reason_code,explanation,
    affected_occurrences,actor_id
  ) values (v_ce.school_id,v_ce.id,'reopened',v_ce.disruption_reason_code,
            btrim(p_explanation),v_count,v_uid);

  return jsonb_build_object('status','reopened',
    'calendar_exception_id',v_ce.id,'restored_occurrences',v_count);
end;
$function$;

-- Guard every teaching writer, including direct use of the legacy start RPC,
-- and close the race between daily generation and an administrator's closure.
create or replace function public.guard_school_disruption_teaching()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_close public.school_calendar_exceptions;
  v_check boolean;
begin
  if tg_op='INSERT' then
    v_check := new.lifecycle in ('planned','ready','in_progress','completed')
      or new.recovered_from_id is not null;
  else
    v_check := new.lifecycle is distinct from old.lifecycle
      and new.lifecycle in ('planned','ready','in_progress','completed');
  end if;
  if not v_check then return new; end if;

  -- Same advisory key as admin_record and admin_reopen. The closure decision
  -- and lesson lifecycle transition cannot pass each other concurrently.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'school-disruption:'||new.school_id::text||':'||new.occurrence_date::text,0
    )
  );
  select * into v_close from public.school_calendar_exceptions ce
  where ce.school_id=new.school_id and ce.exception_date=new.occurrence_date
    and ce.suppress_ordinary_teaching
  order by case when ce.kind='closure' then 0 else 1 end
  limit 1;
  if v_close.id is null then return new; end if;

  if new.recovered_from_id is not null then
    raise exception 'RECOVERY_DATE_CLOSED';
  end if;
  if new.lifecycle in ('planned','ready') then
    -- A concurrent or stale generator must not introduce a normal planned
    -- lesson on a confirmed closure; preserve its original state for reopen.
    new.disruption_previous_lifecycle := new.lifecycle;
    new.disruption_previous_reason := new.exception_reason;
    new.lifecycle := 'missed';
    new.exception_reason := 'School disruption: '||
      coalesce(v_close.disruption_reason_code,v_close.label);
    new.disruption_exception_id := v_close.id;
  elsif tg_op='INSERT' then
    raise exception 'SCHOOL_DAY_CLOSED';
  elsif old.lifecycle not in ('in_progress','completed') then
    raise exception 'SCHOOL_DAY_CLOSED';
  end if;
  return new;
end;
$function$;
revoke all on function public.guard_school_disruption_teaching() from public, anon, authenticated;
drop trigger if exists guard_school_disruption_teaching on public.teaching_occurrences;
create trigger guard_school_disruption_teaching
  before insert or update of lifecycle on public.teaching_occurrences
  for each row execute function public.guard_school_disruption_teaching();

revoke all on function public.admin_preview_school_disruption(uuid,date)
  from public,anon,authenticated;
revoke all on function public.admin_record_school_disruption(uuid,date,text,text)
  from public,anon,authenticated;
revoke all on function public.admin_reopen_school_disruption(uuid,text)
  from public,anon,authenticated;
grant execute on function public.admin_preview_school_disruption(uuid,date)
  to authenticated;
grant execute on function public.admin_record_school_disruption(uuid,date,text,text)
  to authenticated;
grant execute on function public.admin_reopen_school_disruption(uuid,text)
  to authenticated;
commit;
