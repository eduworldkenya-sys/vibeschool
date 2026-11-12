-- Stage 3: confirm one official school timetable using the EXISTING
-- timetable_releases / timetable_slots and existing school membership authority.
-- New governance gates; no school periods, releases or lesson records are seeded.
-- authorization-test: only school administrators may review, approve and publish.
begin;

-- The older migration allowed direct INSERT/UPDATE/DELETE by school admins.
-- RLS school-admin membership is necessary but insufficient: it allows an
-- unaudited client to set status='published' without the transition RPC.
-- SELECT remains member-visible; all changes now go through governed RPCs.
revoke insert,update,delete on table public.timetable_releases from authenticated;
grant select on table public.timetable_releases to authenticated;

-- Independent database constraint: one school may never have two current
-- published releases, including during concurrent or service-side changes.
-- If old production contains duplicate published releases the migration
-- intentionally fails instead of quietly selecting one.
create unique index if not exists timetable_releases_one_published_school
on public.timetable_releases(school_id) where status='published';

-- Create a DRAFT and associate eligible active, previously unassigned slots
-- in ONE transaction. Failure cannot strand a partially-created draft.
create or replace function public.create_school_timetable_release(
  p_school_id uuid,p_label text,p_effective_from date
) returns public.timetable_releases
language plpgsql security definer set search_path=''
as $body$
declare
  v public.timetable_releases%rowtype;
  v_slots integer;
begin
  if (select auth.uid()) is null or not public.is_school_admin(p_school_id) then
    raise exception 'SCHOOL_ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_effective_from is null
    or p_effective_from < (now() at time zone 'Africa/Nairobi')::date
    or nullif(pg_catalog.btrim(p_label),'') is null
    or pg_catalog.length(p_label)>120 then
    raise exception 'INVALID_RELEASE_DETAILS';
  end if;
  -- Lock by school so two simultaneous drafts cannot attach overlapping rows.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('school-timetable-publication:'||p_school_id::text,0)
  );
  if not exists(
    select 1 from public.timetable_slots ts where ts.school_id=p_school_id
      and ts.release_id is null and ts.effective_from<=p_effective_from
      and (ts.effective_until is null or ts.effective_until>=p_effective_from)
  ) then
    raise exception 'NO_UNASSIGNED_SCHOOL_TIMETABLE_SLOTS';
  end if;
  insert into public.timetable_releases(school_id,label,effective_from,status)
  values(p_school_id,pg_catalog.btrim(p_label),p_effective_from,'draft')
  returning * into v;

  update public.timetable_slots ts set release_id=v.id
  where ts.school_id=p_school_id and ts.release_id is null
    and ts.effective_from<=p_effective_from
    and (ts.effective_until is null or ts.effective_until>=p_effective_from);
  get diagnostics v_slots=row_count;
  if v_slots=0 then raise exception 'NO_UNASSIGNED_SCHOOL_TIMETABLE_SLOTS'; end if;
  return v;
end;
$body$;
revoke all on function public.create_school_timetable_release(uuid,text,date) from public,anon,authenticated;
grant execute on function public.create_school_timetable_release(uuid,text,date) to authenticated;

-- The existing release state machine is preserved. This read-only preflight
-- runs as the caller and refuses missing authority, missing periods, incomplete
-- allocations or schedules whose slots are not confirmed by school periods.
create or replace function public.school_timetable_release_preflight(p_release_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $body$
declare
  v public.timetable_releases%rowtype;
  v_periods integer;
  v_slots integer;
  v_invalid_periods integer;
  v_invalid_assignments integer;
  v_unreleased integer;
  v_missing_allocations integer;
  v_bad_allocations integer;
  v_unallocated integer;
  v_uncovered_classes integer;
begin
  select * into v from public.timetable_releases where id = p_release_id;
  if not found then raise exception 'RELEASE_NOT_FOUND'; end if;
  if (select auth.uid()) is null or not public.is_school_admin(v.school_id) then
    raise exception 'SCHOOL_ADMIN_REQUIRED' using errcode='42501';
  end if;

  select count(*) into v_periods from public.school_periods sp
  where sp.school_id=v.school_id and sp.kind='lesson' and not sp.protected;

  select count(*) into v_slots from public.timetable_slots ts
  where ts.school_id=v.school_id and ts.release_id=v.id
    and ts.effective_from <= v.effective_from
    and (ts.effective_until is null or ts.effective_until >= v.effective_from);

  select count(*) into v_invalid_periods
  from public.timetable_slots ts
  left join public.school_periods sp
    on sp.id=ts.period_id and sp.school_id=ts.school_id
    and sp.kind='lesson' and not sp.protected
    and sp.start_time=ts.start_time and sp.end_time=ts.end_time
    and (sp.schedule_day=0 or sp.schedule_day=ts.day_of_week)
  where ts.school_id=v.school_id and ts.release_id=v.id
    and (sp.id is null or ts.day_of_week not between 1 and 7
      or ts.start_time>=ts.end_time or ts.allocation_units<=0);

  select count(*) into v_invalid_assignments
  from public.timetable_slots ts
  where ts.school_id=v.school_id and ts.release_id=v.id and (
    ts.teacher_id is null
    or not exists (select 1 from public.classes c
       where c.id=ts.class_id and c.school_id=v.school_id)
    or not exists (select 1 from public.teacher_classes tc
       where tc.school_id=v.school_id and tc.teacher_id=ts.teacher_id
         and tc.class_id=ts.class_id and tc.subject_id=ts.subject_id)
    or not exists (select 1 from public.school_members sm
       where sm.school_id=v.school_id and sm.profile_id=ts.teacher_id
         and sm.role::text='teacher')
  );

  -- Never certify a subset of active school lessons as the whole timetable.
  -- Previous releases must first be future-effectively closed, not deleted.
  select count(*) into v_unreleased
  from public.timetable_slots ts
  where ts.school_id=v.school_id and ts.release_id is distinct from v.id
    and ts.effective_from<=v.effective_from
    and (ts.effective_until is null or ts.effective_until>=v.effective_from);

  -- Every released class + learning-area needs a school-authorised effective
  -- allocation. The validator is not a replacement for KICD source verification.
  with targets as (
    select distinct ts.class_id,ts.subject_id
    from public.timetable_slots ts
    where ts.school_id=v.school_id and ts.release_id=v.id
  )
  select count(*) into v_missing_allocations from targets t
  where not exists (
    select 1 from public.class_subject_allocations a
    where a.school_id=v.school_id and a.class_id=t.class_id
      and a.subject_id=t.subject_id and a.effective_units_per_week is not null
      and a.effective_from<=v.effective_from
      and (a.effective_until is null or a.effective_until>=v.effective_from)
  );

  -- Each effective allocation for released classes must reconcile to the
  -- number of units represented by recurring slots in this release.
  with classes_in_release as (
    select distinct ts.class_id from public.timetable_slots ts
    where ts.release_id=v.id and ts.school_id=v.school_id
  ), allocations as (
    select a.class_id,a.subject_id,a.effective_units_per_week
    from public.class_subject_allocations a
    join classes_in_release c on c.class_id=a.class_id
    where a.school_id=v.school_id and a.effective_from<=v.effective_from
      and (a.effective_until is null or a.effective_until>=v.effective_from)
  ), actual as (
    select ts.class_id,ts.subject_id,sum(ts.allocation_units) units
    from public.timetable_slots ts
    where ts.school_id=v.school_id and ts.release_id=v.id
      and ts.recurrence_pattern='EVERY_WEEK'
      and ts.effective_from<=v.effective_from
      and (ts.effective_until is null or ts.effective_until>=v.effective_from)
    group by ts.class_id,ts.subject_id
  )
  select count(*) into v_bad_allocations from allocations a
  left join actual x on x.class_id=a.class_id and x.subject_id=a.subject_id
  where a.effective_units_per_week is null
     or coalesce(x.units,0) is distinct from a.effective_units_per_week;

  -- School-wide publication must cover every class with an effective
  -- class-subject allocation, including classes with zero scheduled slots.
  -- Checking only classes in the candidate release could certify a partial
  -- timetable as the entire school's shared timetable.
  select count(distinct a.class_id) into v_uncovered_classes
  from public.class_subject_allocations a
  where a.school_id=v.school_id and a.effective_from<=v.effective_from
    and (a.effective_until is null or a.effective_until>=v.effective_from)
    and not exists (
      select 1 from public.timetable_slots ts
      where ts.school_id=v.school_id and ts.release_id=v.id
        and ts.class_id=a.class_id and ts.effective_from<=v.effective_from
        and (ts.effective_until is null or ts.effective_until>=v.effective_from)
    );

  -- Never approve a release with a subject that lacks any active assignment
  -- target, or one with duplicate/ambiguous targets for the same date.
  select count(*) into v_unallocated from (
    select a.class_id,a.subject_id
    from public.class_subject_allocations a
    where a.school_id=v.school_id and a.effective_from<=v.effective_from
      and (a.effective_until is null or a.effective_until>=v.effective_from)
      and a.class_id in (select ts.class_id from public.timetable_slots ts
                          where ts.school_id=v.school_id and ts.release_id=v.id)
    group by a.class_id,a.subject_id having count(*)>1
  ) duplicates;

  return pg_catalog.jsonb_build_object(
    'release_id',v.id,'school_id',v.school_id,'status',v.status,
    'period_count',v_periods,'slot_count',v_slots,
    'invalid_period_count',v_invalid_periods,
    'invalid_assignment_count',v_invalid_assignments,
    'outside_release_count',v_unreleased,
    'missing_allocation_count',v_missing_allocations,
    'allocation_mismatch_count',v_bad_allocations,
    'ambiguous_allocation_count',v_unallocated,
    'uncovered_school_class_count',v_uncovered_classes,
    'ready',v_periods>0 and v_slots>0 and v_invalid_periods=0
       and v_invalid_assignments=0 and v_unreleased=0
       and v_missing_allocations=0 and v_bad_allocations=0
       and v_unallocated=0
       and v_uncovered_classes=0
  );
end;
$body$;
revoke all on function public.school_timetable_release_preflight(uuid) from public,anon,authenticated;
grant execute on function public.school_timetable_release_preflight(uuid) to authenticated;

-- Harden the EXISTING server-side publication state machine.
-- Do not create a second table or bypass old audited release identities.
create or replace function public.transition_timetable_release(p_release_id uuid,p_target text)
returns public.timetable_releases
language plpgsql security definer set search_path = ''
as $body$
declare
  v public.timetable_releases%rowtype;
  v_uid uuid := (select auth.uid());
  v_blockers integer := 0;
  v_gate jsonb;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v from public.timetable_releases where id=p_release_id;
  if not found then raise exception 'RELEASE_NOT_FOUND'; end if;
  if not public.is_school_admin(v.school_id) then
    raise exception 'SCHOOL_ADMIN_REQUIRED' using errcode='42501';
  end if;

  -- Serialise concurrent publication for one school, including two different
  -- release IDs, rather than just row-locking the same release.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('school-timetable-publication:'||v.school_id::text,0)
  );
  select * into v from public.timetable_releases where id=p_release_id for update;
  if not ((v.status='draft' and p_target='review') or
      (v.status='review' and p_target in ('draft','approved')) or
      (v.status='approved' and p_target in ('review','published')) or
      (v.status='published' and p_target='retired')) then
    raise exception 'INVALID_RELEASE_TRANSITION';
  end if;

  if p_target in ('approved','published') then
    v_gate:=public.school_timetable_release_preflight(v.id);
    if not (v_gate->>'ready')::boolean then
      raise exception 'SCHOOL_TIMETABLE_RELEASE_NOT_READY: %', v_gate::text
        using errcode='23514';
    end if;
    select count(*) into v_blockers from public.timetable_slots ts
    left join public.school_timetable_resources sr on sr.id=ts.resource_id
    left join public.subject_timetable_rules r
      on r.school_id=ts.school_id and r.class_id=ts.class_id and r.subject_id=ts.subject_id
    where ts.school_id=v.school_id and ts.release_id=v.id
      and r.required_resource_type is not null
      and (sr.id is null or sr.resource_type<>r.required_resource_type or not sr.active);
    if v_blockers>0 then raise exception 'TIMETABLE_HAS_RESOURCE_BLOCKERS'; end if;
  end if;

  if p_target='published' then
    -- Retiring the currently published release is immediate. Therefore
    -- publication is allowed ONLY on the effective day. A future-approved
    -- release stays approved until the actual handover day.
    if v.effective_from <> (now() at time zone 'Africa/Nairobi')::date then
      raise exception 'RELEASE_ACTIVATION_DATE_REQUIRED';
    end if;
    update public.timetable_releases
    set status='retired'
    where school_id=v.school_id and status='published' and id<>v.id;
  end if;
  update public.timetable_releases set status=p_target,
    reviewed_by=case when p_target='review' then v_uid else reviewed_by end,
    reviewed_at=case when p_target='review' then now() else reviewed_at end,
    approved_by=case when p_target='approved' then v_uid else approved_by end,
    approved_at=case when p_target='approved' then now() else approved_at end,
    published_by=case when p_target='published' then v_uid else published_by end,
    published_at=case when p_target='published' then now() else published_at end
  where id=p_release_id returning * into v;
  return v;
end;
$body$;
revoke all on function public.transition_timetable_release(uuid,text) from public,anon,authenticated;
grant execute on function public.transition_timetable_release(uuid,text) to authenticated;

-- Existing published teacher reader must verify current school membership
-- even when a teacher's old slot still names their profile.
create or replace function public.get_published_teacher_timetable(
  p_teacher_id uuid,p_on date default null
) returns setof public.timetable_slots
language sql stable security definer set search_path = ''
as $body$
  select ts.* from public.timetable_slots ts
  join public.timetable_releases tr
    on tr.id=ts.release_id and tr.status='published'
  where ts.teacher_id=p_teacher_id
    and public.is_active_school_member(ts.school_id)
    and (p_teacher_id=(select auth.uid()) or public.is_school_admin(ts.school_id))
    and ts.effective_from<=coalesce(p_on,(now() at time zone 'Africa/Nairobi')::date)
    and (ts.effective_until is null
      or ts.effective_until>=coalesce(p_on,(now() at time zone 'Africa/Nairobi')::date))
    and tr.effective_from<=coalesce(p_on,(now() at time zone 'Africa/Nairobi')::date)
  order by ts.day_of_week,ts.start_time;
$body$;
revoke all on function public.get_published_teacher_timetable(uuid,date) from public,anon,authenticated;
grant execute on function public.get_published_teacher_timetable(uuid,date) to authenticated;

-- Prevent deleting or silently reassigning a published historical slot.
-- School admin may close the future range to prepare a separate new version,
-- without rewriting teaching occurrences or changing slot identity.
create or replace function public.protect_published_timetable_slot()
returns trigger language plpgsql security definer set search_path=''
as $body$
declare v_published boolean := false; v_approved boolean := false;
begin
  select (r.published_at is not null),(r.status='approved')
    into v_published,v_approved
  from public.timetable_releases r where r.id=old.release_id;
  -- An approved release must be returned to review before edits. A publish
  -- transition revalidates all blockers but cannot silently alter the signed
  -- off rows between approval and publication.
  if coalesce(v_approved,false) then raise exception 'APPROVED_SLOT_LOCKED'; end if;
  if coalesce(v_published,false) then
    if tg_op='DELETE' then raise exception 'PUBLISHED_SLOT_IMMUTABLE'; end if;
    if not public.is_school_admin(old.school_id) then
      raise exception 'SCHOOL_ADMIN_REQUIRED' using errcode='42501';
    end if;
    if row(
       new.id,new.school_id,new.teacher_id,new.class_id,new.subject_id,
       new.day_of_week,new.start_time,new.end_time,new.room,new.period_id,
       new.allocation_units,new.recurrence_pattern,new.effective_from,
       new.release_id,new.resource_id
    ) is distinct from row(
       old.id,old.school_id,old.teacher_id,old.class_id,old.subject_id,
       old.day_of_week,old.start_time,old.end_time,old.room,old.period_id,
       old.allocation_units,old.recurrence_pattern,old.effective_from,
       old.release_id,old.resource_id
    ) then
      raise exception 'PUBLISHED_SLOT_IMMUTABLE';
    end if;
    if new.effective_until is null
       or new.effective_until < old.effective_from
       or new.effective_until < ((now() at time zone 'Africa/Nairobi')::date - 1)
       or (old.effective_until is not null
           and new.effective_until>old.effective_until)
    then
      raise exception 'PUBLISHED_SLOT_IMMUTABLE';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$body$;
revoke all on function public.protect_published_timetable_slot() from public,anon,authenticated;
drop trigger if exists protect_published_timetable_slot on public.timetable_slots;
create trigger protect_published_timetable_slot
before update or delete on public.timetable_slots
for each row execute function public.protect_published_timetable_slot();

comment on function public.school_timetable_release_preflight(uuid)
is 'Stage 3 official-school timetable readiness; admin only; returns blockers without publication writes.';
commit;
