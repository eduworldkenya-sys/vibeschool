begin;

-- authorization-test: public.lesson_plan_drafts authenticated teachers can only read/write their own assigned school, class and subject; other schools and anonymous callers denied.
-- authorization-test: public.attach_lesson_plan_draft_to_occurrence denies cross-school, cross-subject and cross-teacher attachments, and preserves canonical attendance/evidence identity.

-- Forward-only reconciliation: production recorded the timetable closure migration
-- but was missing the independent lesson draft table and attachment RPC.
-- Existing lesson plans and teaching occurrences are never rewritten here.
create table if not exists public.lesson_plan_drafts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  scheme_id uuid references public.scheme_of_work(id) on delete set null,
  curriculum_id uuid references public.curriculum(id) on delete set null,
  strand_id uuid references public.cbc_strands(id) on delete set null,
  curriculum_outcome_id uuid references public.curriculum_learning_outcomes(id) on delete restrict,
  title text,
  topic text,
  body text,
  duration_minutes integer check(duration_minutes is null or duration_minutes between 10 and 240),
  status text not null default 'draft' check(status in ('draft','ready','archived')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(nullif(btrim(coalesce(title,'')),'') is not null or nullif(btrim(coalesce(body,'')),'') is not null)
);
alter table public.lesson_plan_drafts
  add column if not exists curriculum_outcome_id uuid references public.curriculum_learning_outcomes(id) on delete restrict;
create index if not exists lesson_plan_drafts_owner_idx
  on public.lesson_plan_drafts(teacher_id, school_id, updated_at desc);
create index if not exists lesson_plan_drafts_scope_idx
  on public.lesson_plan_drafts(school_id, class_id, subject_id);
alter table public.lesson_plan_drafts enable row level security;

-- Only authenticated users who still have an exact teacher-class-subject
-- assignment in the claimed school can write drafts. Subject-wide drafts are
-- allowed only with an actual assignment in that school.
create or replace function public.lesson_draft_authorized(
  p_school_id uuid, p_class_id uuid, p_subject_id uuid
) returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.school_members sm
      where sm.school_id = p_school_id and sm.profile_id = auth.uid()
    )
    and exists (
      select 1
      from public.teacher_classes tc
      join public.classes c on c.id = tc.class_id and c.school_id = tc.school_id
      join public.subjects s on s.id = tc.subject_id and s.school_id = tc.school_id
      where tc.teacher_id = auth.uid()
        and tc.school_id = p_school_id
        and tc.subject_id = p_subject_id
        and (p_class_id is null or tc.class_id = p_class_id)
    )
$$;
revoke all on function public.lesson_draft_authorized(uuid,uuid,uuid) from public, anon;
grant execute on function public.lesson_draft_authorized(uuid,uuid,uuid) to authenticated;

-- Validate foreign-key context and canonical outcome lineage even against
-- forged client payloads. Never trust class, scheme or outcome IDs by themselves.
create or replace function public.lesson_draft_validate_scope()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_scheme record;
  v_outcome uuid;
begin
  if not public.lesson_draft_authorized(new.school_id,new.class_id,new.subject_id)
     or new.teacher_id is distinct from auth.uid() then
    raise exception 'DRAFT_ASSIGNMENT_REQUIRED' using errcode = '42501';
  end if;
  if new.scheme_id is not null then
    if new.class_id is null then
      raise exception 'DRAFT_SCHEME_CLASS_REQUIRED';
    end if;
    select school_id,teacher_id,class_id,subject_id,curriculum_id,
           sub_strand_id,curriculum_outcome_id
    into v_scheme from public.scheme_of_work where id = new.scheme_id;
    if not found or v_scheme.school_id is distinct from new.school_id
       or v_scheme.teacher_id is distinct from new.teacher_id
       or v_scheme.class_id is distinct from new.class_id
       or v_scheme.subject_id is distinct from new.subject_id then
      raise exception 'DRAFT_SCHEME_MISMATCH';
    end if;
    v_outcome := v_scheme.curriculum_outcome_id;
    if v_outcome is null or (new.curriculum_outcome_id is not null
                            and new.curriculum_outcome_id <> v_outcome) then
      raise exception 'DRAFT_SCHEME_OUTCOME_REQUIRED';
    end if;
    new.curriculum_outcome_id := v_outcome;
    new.curriculum_id := v_scheme.curriculum_id;
    new.strand_id := v_scheme.sub_strand_id;
  end if;
  if new.curriculum_outcome_id is not null then
    if not exists (
      select 1 from public.curriculum_learning_outcomes co
      where co.id = new.curriculum_outcome_id
        and co.status = 'verified'
        and (new.curriculum_id is null or co.curriculum_id = new.curriculum_id)
    ) then
      raise exception 'DRAFT_OUTCOME_MISMATCH';
    end if;
  end if;
  if new.status = 'ready' and new.curriculum_outcome_id is null then
    raise exception 'DRAFT_OUTCOME_REQUIRED_FOR_READY';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.lesson_draft_validate_scope() from public,anon,authenticated;
drop trigger if exists lesson_drafts_validate_scope on public.lesson_plan_drafts;
create trigger lesson_drafts_validate_scope
before insert or update on public.lesson_plan_drafts
for each row execute function public.lesson_draft_validate_scope();

revoke all on table public.lesson_plan_drafts from public, anon, authenticated;
grant select,insert,update,delete on public.lesson_plan_drafts to authenticated;
grant all on public.lesson_plan_drafts to service_role;
-- The earlier timetable migration may have created broader policies on a
-- clean rebuild. RLS policies are OR-composed: remove these legacy rules.
drop policy if exists lesson_plan_drafts_teacher_select on public.lesson_plan_drafts;
drop policy if exists lesson_plan_drafts_teacher_insert on public.lesson_plan_drafts;
drop policy if exists lesson_plan_drafts_teacher_update on public.lesson_plan_drafts;
drop policy if exists lesson_plan_drafts_teacher_delete on public.lesson_plan_drafts;
drop policy if exists lesson_drafts_select on public.lesson_plan_drafts;
create policy lesson_drafts_select on public.lesson_plan_drafts
for select to authenticated using(
  teacher_id = (select auth.uid())
  and public.lesson_draft_authorized(school_id,class_id,subject_id)
);
drop policy if exists lesson_drafts_insert on public.lesson_plan_drafts;
create policy lesson_drafts_insert on public.lesson_plan_drafts
for insert to authenticated with check(
  teacher_id = (select auth.uid())
  and public.lesson_draft_authorized(school_id,class_id,subject_id)
);
drop policy if exists lesson_drafts_update on public.lesson_plan_drafts;
create policy lesson_drafts_update on public.lesson_plan_drafts
for update to authenticated
using(teacher_id = (select auth.uid())
  and public.lesson_draft_authorized(school_id,class_id,subject_id))
with check(teacher_id = (select auth.uid())
  and public.lesson_draft_authorized(school_id,class_id,subject_id));
drop policy if exists lesson_drafts_delete on public.lesson_plan_drafts;
create policy lesson_drafts_delete on public.lesson_plan_drafts
for delete to authenticated using(
  teacher_id = (select auth.uid())
  and public.lesson_draft_authorized(school_id,class_id,subject_id)
);

-- Attachment reuses canonical dated lesson identity, never moves attendance,
-- evidence, progress or any other teaching occurrence state.
create or replace function public.attach_lesson_plan_draft_to_occurrence(
  p_draft_id uuid, p_timetable_slot_id uuid, p_taught_date date
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_draft public.lesson_plan_drafts%rowtype;
  v_slot public.timetable_slots%rowtype;
  v_existing uuid;
  v_plan_id uuid;
  v_dow integer;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  if p_taught_date is null then raise exception 'INVALID_TAUGHT_DATE'; end if;
  select * into v_draft from public.lesson_plan_drafts
    where id = p_draft_id and teacher_id = v_uid for update;
  if not found then raise exception 'DRAFT_NOT_FOUND' using errcode = '42501'; end if;
  if v_draft.status = 'archived' then raise exception 'DRAFT_ARCHIVED'; end if;
  select * into v_slot from public.timetable_slots
    where id = p_timetable_slot_id and teacher_id = v_uid;
  if not found then raise exception 'SLOT_NOT_FOUND' using errcode = '42501'; end if;
  if v_draft.school_id is distinct from v_slot.school_id
    or v_draft.subject_id is distinct from v_slot.subject_id
    or (v_draft.class_id is not null and v_draft.class_id is distinct from v_slot.class_id)
    or not public.lesson_draft_authorized(v_slot.school_id,v_slot.class_id,v_slot.subject_id) then
    raise exception 'DRAFT_SCHEDULE_SCOPE_MISMATCH' using errcode = '42501';
  end if;
  v_dow := extract(isodow from p_taught_date)::integer;
  if v_dow <> v_slot.day_of_week
    or (v_slot.effective_from is not null and p_taught_date < v_slot.effective_from)
    or (v_slot.effective_until is not null and p_taught_date > v_slot.effective_until) then
    raise exception 'DRAFT_OCCURRENCE_MISMATCH';
  end if;
  select lp.id into v_existing from public.lesson_plans lp
    where lp.timetable_slot_id = p_timetable_slot_id and lp.taught_date = p_taught_date
    limit 1 for update;
  if v_existing is not null then return v_existing; end if;
  insert into public.lesson_plans(
    school_id,teacher_id,class_id,subject_id,timetable_slot_id,
    week_start,day_of_week,taught_date,title,topic,body,
    generated_by,duration_minutes,status,scheme_id,curriculum_id,strand_id,curriculum_outcome_id
  ) values(
    v_slot.school_id,v_uid,v_slot.class_id,v_slot.subject_id,v_slot.id,
    p_taught_date - (v_dow - 1),v_slot.day_of_week,p_taught_date,
    coalesce(nullif(v_draft.title,''),nullif(v_draft.topic,''),'Prepared lesson'),
    v_draft.topic,v_draft.body,'manual',v_draft.duration_minutes,
    'draft',v_draft.scheme_id,v_draft.curriculum_id,v_draft.strand_id,
    v_draft.curriculum_outcome_id
  ) returning id into v_plan_id;
  return v_plan_id;
end;
$$;
revoke all on function public.attach_lesson_plan_draft_to_occurrence(uuid,uuid,date)
  from public,anon,authenticated;
grant execute on function public.attach_lesson_plan_draft_to_occurrence(uuid,uuid,date)
  to authenticated;
select pg_notify('pgrst', 'reload schema');
commit;
