create or replace function public.create_timetable_slot_v2(
  p_class_id uuid,p_subject_id uuid,p_day_of_week integer,p_start_time time,p_end_time time,
  p_room text default null,p_effective_from date default null,p_effective_until date default null,
  p_allocation_units numeric default 1,p_period_id uuid default null
) returns public.timetable_slots
language plpgsql security definer set search_path=public
as $$
declare
  v_teacher_id uuid:=auth.uid(); v_school_id uuid; v_class_school_id uuid;
  v_effective_from date:=coalesce(p_effective_from,(now() at time zone 'Africa/Nairobi')::date);
  v_new public.timetable_slots; v_constraint text;
begin
  if v_teacher_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_class_id is null or p_subject_id is null then raise exception 'INVALID_ASSIGNMENT'; end if;
  if p_day_of_week is null or p_day_of_week<1 or p_day_of_week>7 then raise exception 'INVALID_DAY'; end if;
  if p_start_time is null or p_end_time is null or p_start_time>=p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_effective_until is not null and p_effective_until<v_effective_from then raise exception 'INVALID_EFFECTIVE_RANGE'; end if;
  if p_allocation_units is null or p_allocation_units<=0 or p_allocation_units>8 then raise exception 'INVALID_ALLOCATION_UNITS'; end if;
  select tc.school_id into v_school_id from public.teacher_classes tc
    where tc.teacher_id=v_teacher_id and tc.class_id=p_class_id and tc.subject_id=p_subject_id limit 1;
  if v_school_id is null then raise exception 'INVALID_ASSIGNMENT'; end if;
  select c.school_id into v_class_school_id from public.classes c where c.id=p_class_id;
  if v_class_school_id is distinct from v_school_id then raise exception 'SCHOOL_MISMATCH'; end if;
  if p_period_id is not null and not exists(select 1 from public.school_periods sp where sp.id=p_period_id and sp.school_id=v_school_id) then raise exception 'PERIOD_SCHOOL_MISMATCH'; end if;
  begin
    insert into public.timetable_slots(school_id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,room,period_id,allocation_units,recurrence_pattern,effective_from,effective_until)
    values(v_school_id,v_teacher_id,p_class_id,p_subject_id,p_day_of_week,p_start_time,p_end_time,nullif(btrim(p_room),''),p_period_id,p_allocation_units,'EVERY_WEEK',v_effective_from,p_effective_until)
    returning * into v_new;
  exception when exclusion_violation then
    get stacked diagnostics v_constraint=constraint_name;
    if v_constraint='excl_teacher_overlap' then raise exception 'TEACHER_CONFLICT';
    elsif v_constraint='excl_class_overlap' then raise exception 'CLASS_CONFLICT';
    elsif v_constraint='excl_room_overlap' then raise exception 'ROOM_CONFLICT';
    else raise exception 'SCHEDULE_CONFLICT'; end if;
  when unique_violation then raise exception 'DUPLICATE_SLOT'; end;
  return v_new;
end;
$$;
revoke all on function public.create_timetable_slot_v2(uuid,uuid,integer,time,time,text,date,date,numeric,uuid) from public;
grant execute on function public.create_timetable_slot_v2(uuid,uuid,integer,time,time,text,date,date,numeric,uuid) to authenticated;

create or replace function public.create_school_timetable_slot(
  p_school_id uuid,p_teacher_id uuid,p_class_id uuid,p_subject_id uuid,p_day_of_week integer,
  p_start_time time,p_end_time time,p_room text default null,p_effective_from date default null,
  p_effective_until date default null,p_allocation_units numeric default 1,p_period_id uuid default null
) returns public.timetable_slots
language plpgsql security definer set search_path=public
as $$
declare
  v_effective_from date:=coalesce(p_effective_from,(now() at time zone 'Africa/Nairobi')::date);
  v_new public.timetable_slots; v_constraint text;
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=p_school_id) then raise exception 'CLASS_SCHOOL_MISMATCH'; end if;
  if not exists(select 1 from public.subjects s where s.id=p_subject_id and (s.school_id=p_school_id or s.school_id is null)) then raise exception 'SUBJECT_SCHOOL_MISMATCH'; end if;
  if p_teacher_id is not null and not exists(select 1 from public.teacher_classes tc where tc.school_id=p_school_id and tc.teacher_id=p_teacher_id and tc.class_id=p_class_id and tc.subject_id=p_subject_id) then raise exception 'TEACHER_ASSIGNMENT_REQUIRED'; end if;
  if p_day_of_week is null or p_day_of_week<1 or p_day_of_week>7 then raise exception 'INVALID_DAY'; end if;
  if p_start_time is null or p_end_time is null or p_start_time>=p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_effective_until is not null and p_effective_until<v_effective_from then raise exception 'INVALID_EFFECTIVE_RANGE'; end if;
  if p_allocation_units is null or p_allocation_units<=0 or p_allocation_units>8 then raise exception 'INVALID_ALLOCATION_UNITS'; end if;
  if p_period_id is not null and not exists(select 1 from public.school_periods sp where sp.id=p_period_id and sp.school_id=p_school_id) then raise exception 'PERIOD_SCHOOL_MISMATCH'; end if;
  begin
    insert into public.timetable_slots(school_id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,room,period_id,allocation_units,recurrence_pattern,effective_from,effective_until)
    values(p_school_id,p_teacher_id,p_class_id,p_subject_id,p_day_of_week,p_start_time,p_end_time,nullif(btrim(p_room),''),p_period_id,p_allocation_units,'EVERY_WEEK',v_effective_from,p_effective_until)
    returning * into v_new;
  exception when exclusion_violation then
    get stacked diagnostics v_constraint=constraint_name;
    if v_constraint='excl_teacher_overlap' then raise exception 'TEACHER_CONFLICT';
    elsif v_constraint='excl_class_overlap' then raise exception 'CLASS_CONFLICT';
    elsif v_constraint='excl_room_overlap' then raise exception 'ROOM_CONFLICT';
    else raise exception 'SCHEDULE_CONFLICT'; end if;
  when unique_violation then raise exception 'DUPLICATE_SLOT'; end;
  return v_new;
end;
$$;
revoke all on function public.create_school_timetable_slot(uuid,uuid,uuid,uuid,integer,time,time,text,date,date,numeric,uuid) from public;
grant execute on function public.create_school_timetable_slot(uuid,uuid,uuid,uuid,integer,time,time,text,date,date,numeric,uuid) to authenticated;

create or replace function public.get_timetable_allocation_health(
  p_class_id uuid,p_academic_term_id uuid
) returns table(subject_id uuid,subject_name text,expected_units numeric,scheduled_units numeric,missing_units numeric,excess_units numeric,status text,allocation_source text,is_override boolean,assigned_teacher_count integer,teacher_assignment_health text)
language sql security definer set search_path=public stable
as $$
with ctx as (
 select c.id class_id,c.school_id,t.start_date,t.end_date,
   case when (now() at time zone 'Africa/Nairobi')::date<t.start_date then t.start_date
        when (now() at time zone 'Africa/Nairobi')::date>t.end_date then t.end_date
        else (now() at time zone 'Africa/Nairobi')::date end anchor_date
 from public.classes c join public.academic_terms t on t.id=p_academic_term_id and t.school_id=c.school_id
 where c.id=p_class_id and public.is_active_school_member(c.school_id)
),w as (
 select ctx.*,date_trunc('week',anchor_date)::date week_start,date_trunc('week',anchor_date)::date+6 week_end from ctx
),universe as (
 select a.subject_id from public.class_subject_allocations a join w on w.class_id=a.class_id where a.academic_term_id=p_academic_term_id
 union select tc.subject_id from public.teacher_classes tc join w on w.class_id=tc.class_id
 union select ts.subject_id from public.timetable_slots ts join w on w.class_id=ts.class_id
   where ts.effective_from<=w.week_end and coalesce(ts.effective_until,w.week_end)>=w.week_start
     and ts.effective_from<=(w.week_start+(ts.day_of_week-1)) and coalesce(ts.effective_until,(w.week_start+(ts.day_of_week-1)))>=(w.week_start+(ts.day_of_week-1))
),scheduled as (
 select ts.subject_id,sum(ts.allocation_units)::numeric units,sum(case when ts.teacher_id is null then ts.allocation_units else 0 end)::numeric unassigned_units
 from public.timetable_slots ts join w on w.class_id=ts.class_id
 where ts.effective_from<=w.week_end and coalesce(ts.effective_until,w.week_end)>=w.week_start
   and ts.effective_from<=(w.week_start+(ts.day_of_week-1)) and coalesce(ts.effective_until,(w.week_start+(ts.day_of_week-1)))>=(w.week_start+(ts.day_of_week-1))
 group by ts.subject_id
),teachers as (
 select tc.subject_id,count(distinct tc.teacher_id)::int teacher_count from public.teacher_classes tc join w on w.class_id=tc.class_id group by tc.subject_id
)
select u.subject_id,s.name,a.effective_units_per_week,coalesce(sc.units,0),
 case when a.effective_units_per_week is null then null else greatest(a.effective_units_per_week-coalesce(sc.units,0),0) end,
 case when a.effective_units_per_week is null then null else greatest(coalesce(sc.units,0)-a.effective_units_per_week,0) end,
 case when a.id is null or a.effective_units_per_week is null then 'ALLOCATION_UNKNOWN'
      when coalesce(sc.units,0)=0 then 'UNSCHEDULED'
      when coalesce(sc.units,0)<a.effective_units_per_week then 'UNDER_ALLOCATED'
      when coalesce(sc.units,0)>a.effective_units_per_week then 'OVER_ALLOCATED'
      when coalesce(sc.unassigned_units,0)>0 or coalesce(t.teacher_count,0)=0 then 'TEACHER_UNASSIGNED'
      when a.is_override then 'OVERRIDE' else 'COMPLETE' end,
 coalesce(a.source,'UNKNOWN'),coalesce(a.is_override,false),coalesce(t.teacher_count,0),
 case when coalesce(sc.unassigned_units,0)>0 then 'SLOT_UNASSIGNED'
      when coalesce(t.teacher_count,0)=0 then 'TEACHER_UNASSIGNED' else 'ASSIGNED' end
from universe u join public.subjects s on s.id=u.subject_id
left join public.class_subject_allocations a on a.class_id=p_class_id and a.subject_id=u.subject_id and a.academic_term_id=p_academic_term_id
left join scheduled sc on sc.subject_id=u.subject_id left join teachers t on t.subject_id=u.subject_id order by s.name;
$$;
