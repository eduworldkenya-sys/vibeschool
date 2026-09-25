-- Modern timetable operations: calendar, availability, resources, subject rules, substitution, publication.
-- Repository migration only. Apply through the normal reviewed migration path.

create table if not exists public.school_calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exception_date date not null,
  kind text not null check (kind in ('holiday','closure','exam','event')),
  label text not null,
  suppress_ordinary_teaching boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (school_id, exception_date, kind)
);
alter table public.school_calendar_exceptions enable row level security;
create policy school_calendar_exception_member_read on public.school_calendar_exceptions for select to authenticated
using (public.is_active_school_member(school_id));
create policy school_calendar_exception_admin_write on public.school_calendar_exceptions for all to authenticated
using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create table if not exists public.teacher_timetable_availability (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  availability text not null check (availability in ('unavailable','preferred')),
  reason text,
  effective_from date not null default current_date,
  effective_until date,
  created_at timestamptz not null default now(),
  check (start_time < end_time),
  check (effective_until is null or effective_until >= effective_from)
);
alter table public.teacher_timetable_availability enable row level security;
create policy teacher_availability_read on public.teacher_timetable_availability for select to authenticated
using (teacher_id=(select auth.uid()) or public.is_school_admin(school_id));
create policy teacher_availability_self_write on public.teacher_timetable_availability for all to authenticated
using (teacher_id=(select auth.uid()) or public.is_school_admin(school_id))
with check (teacher_id=(select auth.uid()) or public.is_school_admin(school_id));

create table if not exists public.school_timetable_resources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  resource_type text not null check (resource_type in ('classroom','laboratory','workshop','field','computer_lab','other')),
  capacity integer check (capacity is null or capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
alter table public.school_timetable_resources enable row level security;
create policy timetable_resource_member_read on public.school_timetable_resources for select to authenticated
using (public.is_active_school_member(school_id));
create policy timetable_resource_admin_write on public.school_timetable_resources for all to authenticated
using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create table if not exists public.subject_timetable_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  max_units_per_day numeric check (max_units_per_day is null or max_units_per_day > 0),
  min_teaching_days integer check (min_teaching_days is null or min_teaching_days between 1 and 7),
  consecutive_units integer check (consecutive_units is null or consecutive_units between 1 and 8),
  required_resource_type text check (required_resource_type is null or required_resource_type in ('classroom','laboratory','workshop','field','computer_lab','other')),
  preferred_day_part text check (preferred_day_part is null or preferred_day_part in ('morning','afternoon')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id,class_id,subject_id)
);
alter table public.subject_timetable_rules enable row level security;
create policy subject_timetable_rule_member_read on public.subject_timetable_rules for select to authenticated
using (public.is_active_school_member(school_id));
create policy subject_timetable_rule_admin_write on public.subject_timetable_rules for all to authenticated
using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

alter table public.teaching_occurrences add column if not exists actual_teacher_id uuid references public.profiles(id) on delete set null;
alter table public.teaching_occurrences add column if not exists exception_reason text;

create table if not exists public.teacher_absences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);
alter table public.teacher_absences enable row level security;
create policy teacher_absence_read on public.teacher_absences for select to authenticated
using (teacher_id=(select auth.uid()) or public.is_school_admin(school_id));
create policy teacher_absence_admin_write on public.teacher_absences for all to authenticated
using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create table if not exists public.timetable_releases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','review','approved','published','retired')),
  effective_from date not null,
  label text not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  published_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.timetable_releases enable row level security;
create policy timetable_release_member_read on public.timetable_releases for select to authenticated
using (public.is_active_school_member(school_id));
create policy timetable_release_admin_write on public.timetable_releases for all to authenticated
using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create index if not exists idx_calendar_exception_school_date on public.school_calendar_exceptions(school_id,exception_date);
create index if not exists idx_teacher_availability_teacher_day on public.teacher_timetable_availability(teacher_id,day_of_week);
create index if not exists idx_teacher_absence_teacher_range on public.teacher_absences(teacher_id,starts_at,ends_at);
create index if not exists idx_subject_timetable_rules_lookup on public.subject_timetable_rules(class_id,subject_id);

create or replace function public.assign_occurrence_substitute(p_occurrence_id uuid,p_substitute_teacher_id uuid,p_reason text)
returns public.teaching_occurrences language plpgsql security definer set search_path=public as $$
declare v public.teaching_occurrences;
begin
  select * into v from public.teaching_occurrences where id=p_occurrence_id for update;
  if v.id is null then raise exception 'OCCURRENCE_NOT_FOUND'; end if;
  if not public.is_school_admin(v.school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
  if v.lifecycle in ('completed','cancelled','rescheduled') then raise exception 'OCCURRENCE_LOCKED'; end if;
  if not exists(select 1 from public.school_members sm where sm.school_id=v.school_id and sm.profile_id=p_substitute_teacher_id and sm.role='teacher') then
    raise exception 'SUBSTITUTE_NOT_SCHOOL_TEACHER';
  end if;
  if exists(
    select 1 from public.teaching_occurrences o join public.timetable_slots s on s.id=o.timetable_slot_id
    join public.timetable_slots target on target.id=v.timetable_slot_id
    where coalesce(o.actual_teacher_id,o.teacher_id)=p_substitute_teacher_id
      and o.occurrence_date=v.occurrence_date and o.id<>v.id
      and o.lifecycle not in ('cancelled','rescheduled')
      and s.start_time < target.end_time and s.end_time > target.start_time
  ) then raise exception 'SUBSTITUTE_CONFLICT'; end if;
  update public.teaching_occurrences set actual_teacher_id=p_substitute_teacher_id,exception_reason=nullif(btrim(p_reason),'') where id=v.id returning * into v;
  return v;
end $$;
revoke all on function public.assign_occurrence_substitute(uuid,uuid,text) from public;
grant execute on function public.assign_occurrence_substitute(uuid,uuid,text) to authenticated;

create or replace function public.generate_daily_occurrences(p_date date default null)
returns table (generated integer, marked_missed integer)
language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=auth.uid(); v_today date:=(now() at time zone 'Africa/Nairobi')::date;
  v_date date:=coalesce(p_date,(now() at time zone 'Africa/Nairobi')::date);
  v_dow integer; v_generated integer; v_missed integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_date<v_today or v_date>v_today+7 then raise exception 'invalid_date'; end if;
  v_dow:=extract(isodow from v_date)::integer;
  insert into public.teaching_occurrences(timetable_slot_id,occurrence_date,school_id,teacher_id,class_id,subject_id,lifecycle)
  select s.id,v_date,s.school_id,s.teacher_id,s.class_id,s.subject_id,'planned'
  from public.timetable_slots s
  where s.teacher_id=v_uid and s.day_of_week=v_dow and s.effective_from<=v_date
    and (s.effective_until is null or s.effective_until>=v_date)
    and exists(select 1 from public.academic_terms t where t.school_id=s.school_id and v_date between t.start_date and t.end_date)
    and not exists(select 1 from public.school_calendar_exceptions e where e.school_id=s.school_id and e.exception_date=v_date and e.suppress_ordinary_teaching)
  on conflict(timetable_slot_id,occurrence_date) do nothing;
  get diagnostics v_generated=row_count;

  update public.teaching_occurrences o set lifecycle='missed'
  where o.teacher_id=v_uid and o.lifecycle in ('planned','ready') and o.occurrence_date<v_today
    and not exists(select 1 from public.school_calendar_exceptions e where e.school_id=o.school_id and e.exception_date=o.occurrence_date and e.suppress_ordinary_teaching);
  get diagnostics v_missed=row_count;
  return query select v_generated,v_missed;
end $$;
revoke all on function public.generate_daily_occurrences(date) from public;
grant execute on function public.generate_daily_occurrences(date) to authenticated;


-- Resource identity on recurring slots. Keep legacy room text for compatibility/display.
alter table public.timetable_slots add column if not exists resource_id uuid references public.school_timetable_resources(id) on delete set null;
alter table public.timetable_slots add column if not exists release_id uuid references public.timetable_releases(id) on delete set null;
create index if not exists idx_timetable_slots_resource on public.timetable_slots(resource_id);
create index if not exists idx_timetable_slots_release on public.timetable_slots(release_id);

create or replace function public.attach_active_slots_to_release(p_release_id uuid)
returns integer language plpgsql security definer set search_path=public as $
declare v public.timetable_releases; n integer;
begin
 select * into v from public.timetable_releases where id=p_release_id;
 if v.id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
 if not public.is_school_admin(v.school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
 if v.status<>'draft' then raise exception 'RELEASE_NOT_DRAFT'; end if;
 update public.timetable_slots set release_id=v.id where school_id=v.school_id and effective_from<=v.effective_from
   and coalesce(effective_until,v.effective_from)>=v.effective_from and release_id is null;
 get diagnostics n=row_count; return n;
end $;
revoke all on function public.attach_active_slots_to_release(uuid) from public;
grant execute on function public.attach_active_slots_to_release(uuid) to authenticated;

-- Publication is a server-authoritative state machine.
create or replace function public.transition_timetable_release(p_release_id uuid,p_target text)
returns public.timetable_releases language plpgsql security definer set search_path=public as $
declare v public.timetable_releases; v_uid uuid:=auth.uid(); v_blockers integer:=0;
begin
 if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
 select * into v from public.timetable_releases where id=p_release_id for update;
 if v.id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
 if not public.is_school_admin(v.school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
 if not ((v.status='draft' and p_target='review') or (v.status='review' and p_target in ('draft','approved')) or
         (v.status='approved' and p_target in ('review','published')) or (v.status='published' and p_target='retired')) then
   raise exception 'INVALID_RELEASE_TRANSITION';
 end if;
 if p_target in ('approved','published') then
   select count(*) into v_blockers from public.timetable_slots ts
   left join public.school_timetable_resources sr on sr.id=ts.resource_id
   left join public.subject_timetable_rules r on r.school_id=ts.school_id and r.class_id=ts.class_id and r.subject_id=ts.subject_id
   where ts.school_id=v.school_id and ts.release_id=v.id and
    (r.required_resource_type is not null and (sr.id is null or sr.resource_type<>r.required_resource_type or not sr.active));
   if v_blockers>0 then raise exception 'TIMETABLE_HAS_RESOURCE_BLOCKERS'; end if;
 end if;
 if p_target='published' then
   update public.timetable_releases set status='retired' where school_id=v.school_id and status='published' and id<>v.id;
 end if;
 update public.timetable_releases set status=p_target,
  reviewed_by=case when p_target='review' then v_uid else reviewed_by end, reviewed_at=case when p_target='review' then now() else reviewed_at end,
  approved_by=case when p_target='approved' then v_uid else approved_by end, approved_at=case when p_target='approved' then now() else approved_at end,
  published_by=case when p_target='published' then v_uid else published_by end, published_at=case when p_target='published' then now() else published_at end
 where id=p_release_id returning * into v; return v;
end $;
revoke all on function public.transition_timetable_release(uuid,text) from public;
grant execute on function public.transition_timetable_release(uuid,text) to authenticated;

-- Absence is occurrence truth, not a recurring-slot mutation. Upcoming occurrences are
-- retained and explicitly flagged so an admin can substitute, cancel, or recover them.
create or replace function public.apply_teacher_absence(p_absence_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare a public.teacher_absences; n integer;
begin
  select * into a from public.teacher_absences where id=p_absence_id;
  if a.id is null then raise exception 'ABSENCE_NOT_FOUND'; end if;
  if auth.uid()<>a.teacher_id and not public.is_school_admin(a.school_id) then raise exception 'ABSENCE_ACCESS_DENIED'; end if;
  update public.teaching_occurrences o set exception_reason=coalesce(nullif(btrim(a.reason),''),'Teacher absent')
  from public.timetable_slots s
  where o.timetable_slot_id=s.id and o.teacher_id=a.teacher_id and o.school_id=a.school_id
    and o.lifecycle in ('planned','ready')
    and (o.occurrence_date+s.start_time) at time zone 'Africa/Nairobi' < a.ends_at
    and (o.occurrence_date+s.end_time) at time zone 'Africa/Nairobi' > a.starts_at;
  get diagnostics n=row_count; return n;
end $$;
revoke all on function public.apply_teacher_absence(uuid) from public;
grant execute on function public.apply_teacher_absence(uuid) to authenticated;

-- Whole-school deterministic candidate generator. It proposes only hard-valid placements;
-- final writes still pass through the canonical collision-protected writer.
create or replace function public.suggest_school_timetable_candidates(
  p_school_id uuid,p_class_id uuid,p_subject_id uuid,p_teacher_id uuid,p_effective_on date default null
) returns table(day_of_week integer,period_id uuid,start_time time,end_time time,score integer,explanation text)
language sql security definer set search_path=public stable as $$
with ctx as (select coalesce(p_effective_on,(now() at time zone 'Africa/Nairobi')::date) d),
days as (select generate_series(1,5)::int dow),
candidates as (
 select d.dow,sp.id period_id,sp.start_time,sp.end_time
 from days d cross join public.school_periods sp cross join ctx
 where sp.school_id=p_school_id and sp.kind='lesson'
   and public.is_school_admin(p_school_id)
   and not exists(select 1 from public.teacher_timetable_availability ta where ta.school_id=p_school_id and ta.teacher_id=p_teacher_id
     and ta.day_of_week=d.dow and ta.availability='unavailable' and ta.start_time<sp.end_time and ta.end_time>sp.start_time
     and ta.effective_from<=ctx.d and coalesce(ta.effective_until,ctx.d)>=ctx.d)
   and not exists(select 1 from public.timetable_slots ts where ts.school_id=p_school_id and ts.day_of_week=d.dow
     and ts.start_time<sp.end_time and ts.end_time>sp.start_time
     and (ts.teacher_id=p_teacher_id or ts.class_id=p_class_id)
     and ts.effective_from<=ctx.d and coalesce(ts.effective_until,ctx.d)>=ctx.d)
), scored as (
 select c.*, (case when r.preferred_day_part='morning' and c.start_time<'12:00' then 20
                   when r.preferred_day_part='afternoon' and c.start_time>='12:00' then 20 else 0 end)
   - 2*(select count(*) from public.timetable_slots ts cross join ctx where ts.school_id=p_school_id and ts.teacher_id=p_teacher_id
         and ts.day_of_week=c.dow and ts.effective_from<=ctx.d and coalesce(ts.effective_until,ctx.d)>=ctx.d)::int score
 from candidates c left join public.subject_timetable_rules r on r.school_id=p_school_id and r.class_id=p_class_id and r.subject_id=p_subject_id
)
select dow,period_id,start_time,end_time,score,
 case when score>=20 then 'Preferred teaching time; no hard conflict.' else 'No hard conflict; ranked by teacher daily load.' end
from scored order by score desc,dow,start_time;
$$;
revoke all on function public.suggest_school_timetable_candidates(uuid,uuid,uuid,uuid,date) from public;
grant execute on function public.suggest_school_timetable_candidates(uuid,uuid,uuid,uuid,date) to authenticated;


-- Canonical published timetable readers for cross-surface convergence.
create or replace function public.get_published_class_timetable(p_class_id uuid,p_on date default null)
returns setof public.timetable_slots language sql security definer set search_path=public stable as $$
 select ts.* from public.timetable_slots ts
 join public.timetable_releases tr on tr.id=ts.release_id and tr.status='published'
 where ts.class_id=p_class_id and public.is_active_school_member(ts.school_id)
   and ts.effective_from<=coalesce(p_on,current_date) and coalesce(ts.effective_until,coalesce(p_on,current_date))>=coalesce(p_on,current_date)
 order by ts.day_of_week,ts.start_time;
$$;
revoke all on function public.get_published_class_timetable(uuid,date) from public;
grant execute on function public.get_published_class_timetable(uuid,date) to authenticated;

create or replace function public.get_published_teacher_timetable(p_teacher_id uuid,p_on date default null)
returns setof public.timetable_slots language sql security definer set search_path=public stable as $$
 select ts.* from public.timetable_slots ts
 join public.timetable_releases tr on tr.id=ts.release_id and tr.status='published'
 where ts.teacher_id=p_teacher_id and (p_teacher_id=auth.uid() or public.is_school_admin(ts.school_id))
   and ts.effective_from<=coalesce(p_on,current_date) and coalesce(ts.effective_until,coalesce(p_on,current_date))>=coalesce(p_on,current_date)
 order by ts.day_of_week,ts.start_time;
$$;
revoke all on function public.get_published_teacher_timetable(uuid,date) from public;
grant execute on function public.get_published_teacher_timetable(uuid,date) to authenticated;
