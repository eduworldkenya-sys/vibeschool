-- Initially scaffolded with Supabase CLI 2.113.0 on 2026-10-11; renumbered after merged PR #764 to maintain monotonic migration order. STAGED ONLY.
-- DO NOT db push until historical migration-version equivalence is reconciled.
-- Verified candidate: original path docs/engineering/class-life-library/canonical_learner_leadership_migration_candidate.sql
-- until the active supabase/migrations scope lease is released.
-- No change to Class Hub visual system. Uses students.id, student_classes,
-- teacher_classes, class_groups/members and school academic_terms.
create table public.class_learner_appointments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  class_id uuid not null references public.classes(id),
  student_id uuid not null references public.students(id),
  academic_term_id uuid not null references public.academic_terms(id),
  group_id uuid references public.class_groups(id),
  role_code text not null check (role_code in ('representative','deputy','prefect','group_leader')),
  starts_on date not null,
  ends_on date not null,
  appointed_by uuid not null references public.profiles(id),
  request_id uuid,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.profiles(id),
  ended_reason text check (ended_reason in ('replaced','resigned','removed','completed')),
  handover_request_id uuid,
  handover_scheduled_by uuid references public.profiles(id),
  handover_scheduled_at timestamptz,
  constraint class_leader_dates_chk check (starts_on<=ends_on),
  constraint class_leader_scope_chk check ((role_code='group_leader')=(group_id is not null))
);
create index class_learner_appointments_student_history_idx
  on public.class_learner_appointments(student_id,class_id,starts_on desc);
create index class_learner_appointments_class_current_idx
  on public.class_learner_appointments(class_id,ends_on)
  where ended_at is null;
create unique index class_learner_appointments_request_uidx
  on public.class_learner_appointments(appointed_by,request_id)
  where request_id is not null;
-- Concurrent role claims are serialized by school_appoint_class_learner.
-- Overlapping future intervals cannot coexist, but an incumbent and a future
-- appointment may coexist until the scheduled handover date.
create unique index class_learner_appointments_class_lead_start_uidx
  on public.class_learner_appointments(class_id,role_code,starts_on)
  where ended_at is null and role_code in ('representative','deputy');
create unique index class_learner_appointments_group_lead_start_uidx
  on public.class_learner_appointments(group_id,starts_on)
  where ended_at is null and role_code='group_leader';

alter table public.class_learner_appointments enable row level security;
create policy class_learner_appointments_teacher_read
on public.class_learner_appointments for select to authenticated
using (
  public.is_operational_school_member(school_id)
  and (
    public.is_school_admin(school_id)
    or public.teacher_can_access_class(class_id,null,false)
  )
);
revoke all on public.class_learner_appointments from public,anon,authenticated;
grant select on public.class_learner_appointments to authenticated;
grant all on public.class_learner_appointments to service_role;

-- Appointment is distinct from the daily/weekly class duty roster; never use
-- a duty row or free-text learner note as leadership appointment authority.
create or replace function public.school_appoint_class_learner(
  p_class_id uuid,p_student_id uuid,p_role_code text,p_starts_on date,
  p_ends_on date,p_group_id uuid,p_request_id uuid
) returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_school uuid; v_subject uuid; v_term uuid;
  v_existing public.class_learner_appointments%rowtype;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'appointment_request_required'; end if;
  if p_role_code is null or p_role_code not in ('representative','deputy','prefect','group_leader') then
    raise exception 'leadership_role_invalid';
  end if;
  if p_starts_on is null or p_ends_on is null or p_starts_on>p_ends_on or p_ends_on<current_date then
    raise exception 'appointment_dates_invalid';
  end if;
  if (p_role_code='group_leader') is distinct from (p_group_id is not null) then
    raise exception 'leadership_scope_invalid';
  end if;
  select c.school_id into v_school from public.classes c where c.id=p_class_id;
  if v_school is null then raise exception 'class_not_found'; end if;
  if p_group_id is not null then
    select g.subject_id into v_subject
    from public.class_groups g
    where g.id=p_group_id and g.class_id=p_class_id and g.school_id=v_school
      and g.archived_at is null and (g.expires_at is null or g.expires_at>now());
    if not found then raise exception 'class_group_not_found'; end if;
    if not exists(
      select 1 from public.class_group_members gm
      where gm.group_id=p_group_id and gm.student_id=p_student_id
    ) then raise exception 'group_membership_required'; end if;
  end if;
  if not (
    public.is_school_admin(v_school)
    or (p_group_id is null and public.teacher_can_access_class(p_class_id,null,true))
    or (p_group_id is not null
        and public.teacher_can_access_class(p_class_id,v_subject,v_subject is null))
  ) then raise exception 'leadership_authorization_required' using errcode='42501'; end if;
  if not exists(
    select 1 from public.student_classes sc join public.students s on s.id=sc.student_id
    where sc.class_id=p_class_id and sc.student_id=p_student_id and sc.school_id=v_school
      and sc.is_current and s.deleted_at is null
  ) then raise exception 'learner_not_currently_enrolled' using errcode='42501'; end if;

  select t.id into v_term from public.academic_terms t
  where t.school_id=v_school and p_starts_on between t.start_date and t.end_date
    and p_ends_on<=t.end_date
  order by t.start_date desc limit 1;
  if v_term is null then raise exception 'school_term_required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_class_id::text||':'||p_role_code||':'||coalesce(p_group_id::text,'class'),0
  ));
  select * into v_existing from public.class_learner_appointments
  where appointed_by=v_uid and request_id=p_request_id;
  if found then
    if v_existing.class_id is distinct from p_class_id
       or v_existing.student_id is distinct from p_student_id
       or v_existing.role_code is distinct from p_role_code
       or v_existing.group_id is distinct from p_group_id
       or v_existing.starts_on is distinct from p_starts_on
       or v_existing.ends_on is distinct from p_ends_on then
       raise exception 'appointment_request_payload_conflict';
    end if;
    return v_existing.id;
  end if;

  if p_role_code in ('representative','deputy','group_leader') then
    -- Existing starts after the requested start are a competing future
    -- handover. Explicit cancellation is required, never silently overwrite.
    if exists (
      select 1 from public.class_learner_appointments a
      where a.class_id=p_class_id and a.role_code=p_role_code
        and a.group_id is not distinct from p_group_id
        and a.ended_at is null and a.starts_on>p_starts_on
        and a.starts_on<=p_ends_on
    ) then raise exception 'future_leadership_appointment_conflict'; end if;

    -- End same-day incumbent explicitly. For future handovers, truncate the
    -- incumbent at the previous school day while retaining historical record.
    update public.class_learner_appointments a
      set ended_at=now(),ended_by=v_uid,ended_reason='replaced',
          handover_request_id=p_request_id,
          handover_scheduled_by=v_uid,handover_scheduled_at=now()
    where a.class_id=p_class_id and a.role_code=p_role_code
      and a.group_id is not distinct from p_group_id and a.ended_at is null
      and a.starts_on=p_starts_on;

    update public.class_learner_appointments a
      set ends_on=p_starts_on-1,
          handover_request_id=p_request_id,
          handover_scheduled_by=v_uid,handover_scheduled_at=now()
    where a.class_id=p_class_id and a.role_code=p_role_code
      and a.group_id is not distinct from p_group_id and a.ended_at is null
      and a.starts_on<p_starts_on and a.ends_on>=p_starts_on;
  elsif exists (
    select 1 from public.class_learner_appointments a
    where a.class_id=p_class_id and a.student_id=p_student_id
      and a.role_code=p_role_code and a.ended_at is null
      and a.starts_on<=p_ends_on and a.ends_on>=p_starts_on
  ) then raise exception 'duplicate_active_prefect_appointment'; end if;
  insert into public.class_learner_appointments(
    school_id,class_id,student_id,academic_term_id,group_id,role_code,
    starts_on,ends_on,appointed_by,request_id
  ) values(v_school,p_class_id,p_student_id,v_term,p_group_id,p_role_code,
    p_starts_on,p_ends_on,v_uid,p_request_id) returning id into v_id;
  return v_id;
end $$;

create or replace function public.school_end_class_learner_appointment(
  p_appointment_id uuid,p_reason text
) returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare v_appointment public.class_learner_appointments%rowtype; v_subject uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if p_reason not in ('resigned','removed','completed') then
    raise exception 'appointment_end_reason_invalid';
  end if;
  select * into v_appointment from public.class_learner_appointments
  where id=p_appointment_id for update;
  if not found then raise exception 'appointment_not_found'; end if;
  if v_appointment.group_id is not null then
    select subject_id into v_subject from public.class_groups where id=v_appointment.group_id;
  end if;
  if not (
    public.is_school_admin(v_appointment.school_id)
    or (v_appointment.group_id is null and
      public.teacher_can_access_class(v_appointment.class_id,null,true))
    or (v_appointment.group_id is not null and
      public.teacher_can_access_class(v_appointment.class_id,v_subject,v_subject is null))
  ) then raise exception 'leadership_authorization_required' using errcode='42501'; end if;
  if v_appointment.ended_at is not null then return v_appointment.id; end if;
  update public.class_learner_appointments
    set ended_at=now(),ended_by=auth.uid(),ended_reason=p_reason
  where id=p_appointment_id;
  return p_appointment_id;
end $$;

-- Closing canonical enrolment or group membership must close appointments.
-- This prevents transferred learners from remaining active class/group leaders.
create or replace function public.end_class_leadership_on_enrollment_exit()
returns trigger language plpgsql security definer
set search_path=public,auth,pg_temp as $$
begin
  if old.is_current and not new.is_current then
    update public.class_learner_appointments
      set ended_at=now(),ended_by=auth.uid(),ended_reason='completed'
      where class_id=old.class_id and school_id=old.school_id
        and student_id=old.student_id and ended_at is null;
  end if;
  return new;
end $$;
create trigger end_class_leadership_enrollment_exit
after update of is_current on public.student_classes
for each row execute function public.end_class_leadership_on_enrollment_exit();

create or replace function public.end_group_leadership_on_member_remove()
returns trigger language plpgsql security definer
set search_path=public,auth,pg_temp as $$
begin
  update public.class_learner_appointments
  set ended_at=now(),ended_by=auth.uid(),ended_reason='completed'
  where group_id=old.group_id and student_id=old.student_id and ended_at is null;
  return old;
end $$;
create trigger end_group_leadership_member_remove
after delete on public.class_group_members
for each row execute function public.end_group_leadership_on_member_remove();

create or replace function public.end_group_leadership_on_archive()
returns trigger language plpgsql security definer
set search_path=public,auth,pg_temp as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    update public.class_learner_appointments
    set ended_at=now(),ended_by=auth.uid(),ended_reason='completed'
    where group_id=new.id and ended_at is null;
  end if;
  return new;
end $$;
create trigger end_group_leadership_archive
after update of archived_at on public.class_groups
for each row execute function public.end_group_leadership_on_archive();

revoke all on function public.end_class_leadership_on_enrollment_exit() from public,anon,authenticated;
revoke all on function public.end_group_leadership_on_member_remove() from public,anon,authenticated;
revoke all on function public.end_group_leadership_on_archive() from public,anon,authenticated;

-- Projection-only reads keep Class Hub and learner history connected to the
-- same appointment ledger rather than duplicating appointments in profiles.
create or replace function public.school_get_class_leadership(p_class_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=public,auth,pg_temp as $$
declare v_school uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  select school_id into v_school from public.classes where id=p_class_id;
  if v_school is null then raise exception 'class_not_found'; end if;
  if not (
    public.is_school_admin(v_school) or
    public.teacher_can_access_class(p_class_id,null,false)
  ) then raise exception 'leadership_authorization_required' using errcode='42501'; end if;
  select jsonb_build_object(
    'current',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'student_id',a.student_id,'student_name',s.name,
        'role',a.role_code,'group_id',a.group_id,'group_name',g.name,
        'starts_on',a.starts_on,'ends_on',a.ends_on,
        'appointed_by',a.appointed_by
      ) order by a.role_code,s.name)
      from public.class_learner_appointments a
      join public.students s on s.id=a.student_id
      left join public.class_groups g on g.id=a.group_id
      where a.class_id=p_class_id and a.school_id=v_school
        and a.ended_at is null and current_date between a.starts_on and a.ends_on
        and (g.id is null or (g.archived_at is null and (g.expires_at is null or g.expires_at>now())))
    ),'[]'::jsonb),
    'upcoming',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'student_id',a.student_id,'student_name',s.name,
        'role',a.role_code,'group_id',a.group_id,
        'starts_on',a.starts_on,'ends_on',a.ends_on
      ) order by a.starts_on)
      from public.class_learner_appointments a
      join public.students s on s.id=a.student_id
      where a.class_id=p_class_id and a.school_id=v_school
        and a.ended_at is null and a.starts_on>current_date
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.school_get_learner_leadership(
  p_class_id uuid,p_student_id uuid
) returns jsonb language plpgsql stable security definer
set search_path=public,auth,pg_temp as $$
declare v_school uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  select school_id into v_school from public.classes where id=p_class_id;
  if v_school is null then raise exception 'class_not_found'; end if;
  if not (
    public.is_school_admin(v_school) or
    public.teacher_can_access_class(p_class_id,null,false)
  ) then raise exception 'leadership_authorization_required' using errcode='42501'; end if;
  if not exists (
    select 1 from public.student_classes sc
    where sc.class_id=p_class_id and sc.school_id=v_school
      and sc.student_id=p_student_id
  ) then raise exception 'learner_not_enrolled_in_class'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'role',a.role_code,'group_id',a.group_id,'group_name',g.name,
    'starts_on',a.starts_on,'ends_on',a.ends_on,
    'ended_at',a.ended_at,'ended_reason',a.ended_reason,
    'handover_request_id',a.handover_request_id,
    'handover_scheduled_at',a.handover_scheduled_at,
    'appointed_by',a.appointed_by
  ) order by a.starts_on desc,a.created_at desc),'[]'::jsonb)
  into v_result from public.class_learner_appointments a
  left join public.class_groups g on g.id=a.group_id
  where a.class_id=p_class_id and a.school_id=v_school and a.student_id=p_student_id;
  return v_result;
end $$;

revoke all on function public.school_get_class_leadership(uuid) from public,anon;
revoke all on function public.school_get_learner_leadership(uuid,uuid) from public,anon;
grant execute on function public.school_get_class_leadership(uuid) to authenticated;
grant execute on function public.school_get_learner_leadership(uuid,uuid) to authenticated;

revoke all on function public.school_appoint_class_learner(uuid,uuid,text,date,date,uuid,uuid) from public,anon;
revoke all on function public.school_end_class_learner_appointment(uuid,text) from public,anon;
grant execute on function public.school_appoint_class_learner(uuid,uuid,text,date,date,uuid,uuid) to authenticated;
grant execute on function public.school_end_class_learner_appointment(uuid,text) to authenticated;
