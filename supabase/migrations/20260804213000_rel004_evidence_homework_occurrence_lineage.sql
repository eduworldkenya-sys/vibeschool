begin;

create table if not exists public.lesson_evidence_resource_usage (
  id uuid primary key default gen_random_uuid(),
  lesson_evidence_id uuid not null
    references public.lesson_evidence(id)
    on delete cascade,
  occurrence_resource_usage_id uuid not null
    references public.teaching_occurrence_resource_usage(id)
    on delete cascade,
  teaching_occurrence_id uuid not null
    references public.teaching_occurrences(id)
    on delete cascade,
  resource_id uuid not null
    references public.learning_resources(id)
    on delete restrict,
  teacher_id uuid not null
    references public.profiles(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  unique (lesson_evidence_id, resource_id)
);

create index if not exists
  lesson_evidence_resource_usage_evidence_idx
on public.lesson_evidence_resource_usage(
  lesson_evidence_id
);

create index if not exists
  lesson_evidence_resource_usage_occurrence_idx
on public.lesson_evidence_resource_usage(
  teaching_occurrence_id
);

create index if not exists
  lesson_evidence_resource_usage_resource_idx
on public.lesson_evidence_resource_usage(
  resource_id
);

alter table
  public.lesson_evidence_resource_usage
enable row level security;

create policy
  lesson_evidence_resource_usage_teacher_select
on public.lesson_evidence_resource_usage
for select to authenticated
using (
  teacher_id = (select auth.uid())
);

create policy
  lesson_evidence_resource_usage_teacher_insert
on public.lesson_evidence_resource_usage
for insert to authenticated
with check (
  teacher_id = (select auth.uid())
);

alter table public.homework
  add column if not exists
    teaching_occurrence_id uuid null
  references public.teaching_occurrences(id)
  on delete set null;

create index if not exists
  homework_teaching_occurrence_idx
on public.homework(teaching_occurrence_id)
where teaching_occurrence_id is not null;

create or replace function
  public.link_evidence_to_occurrence_resources(
    p_evidence_id uuid,
    p_occurrence_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  evidence_row public.lesson_evidence%rowtype;
  occurrence_owner uuid;
  inserted_count integer := 0;
begin
  if caller is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_authenticated'
    );
  end if;

  select *
  into evidence_row
  from public.lesson_evidence
  where id = p_evidence_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'evidence_not_found'
    );
  end if;

  if evidence_row.teacher_id <> caller then
    return jsonb_build_object(
      'ok', false,
      'error', 'evidence_not_owned'
    );
  end if;

  if evidence_row.teaching_occurrence_id
     is distinct from p_occurrence_id then
    return jsonb_build_object(
      'ok', false,
      'error',
      'evidence_occurrence_mismatch'
    );
  end if;

  select teacher_id
  into occurrence_owner
  from public.teaching_occurrences
  where id = p_occurrence_id;

  if occurrence_owner is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'occurrence_not_found'
    );
  end if;

  if occurrence_owner <> caller then
    return jsonb_build_object(
      'ok', false,
      'error', 'occurrence_not_owned'
    );
  end if;

  insert into
    public.lesson_evidence_resource_usage(
      lesson_evidence_id,
      occurrence_resource_usage_id,
      teaching_occurrence_id,
      resource_id,
      teacher_id
    )
  select
    evidence_row.id,
    usage.id,
    usage.teaching_occurrence_id,
    usage.resource_id,
    caller
  from
    public.teaching_occurrence_resource_usage
      usage
  where usage.teaching_occurrence_id =
    p_occurrence_id
    and usage.teacher_id = caller
  on conflict (
    lesson_evidence_id,
    resource_id
  ) do nothing;

  get diagnostics inserted_count =
    row_count;

  return jsonb_build_object(
    'ok', true,
    'linked_count', inserted_count
  );
end;
$$;

create or replace function
  public.validate_homework_teaching_lineage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  occurrence_row
    public.teaching_occurrences%rowtype;
  lesson_row
    public.lesson_plans%rowtype;
begin
  if new.teaching_occurrence_id is null then
    return new;
  end if;

  if new.lesson_plan_id is null then
    raise exception
      'teaching_occurrence_id requires lesson_plan_id';
  end if;

  select *
  into occurrence_row
  from public.teaching_occurrences
  where id = new.teaching_occurrence_id;

  if not found then
    raise exception
      'Teaching occurrence not found';
  end if;

  select *
  into lesson_row
  from public.lesson_plans
  where id = new.lesson_plan_id;

  if not found then
    raise exception 'Lesson plan not found';
  end if;

  if new.teacher_id
       is distinct from
       occurrence_row.teacher_id
     or new.class_id
       is distinct from
       occurrence_row.class_id
     or new.school_id
       is distinct from
       occurrence_row.school_id
     or lesson_row.teacher_id
       is distinct from
       occurrence_row.teacher_id
     or lesson_row.class_id
       is distinct from
       occurrence_row.class_id
     or lesson_row.subject_id
       is distinct from
       occurrence_row.subject_id
     or lesson_row.timetable_slot_id
       is distinct from
       occurrence_row.timetable_slot_id
     or lesson_row.taught_date
       is distinct from
       occurrence_row.occurrence_date
  then
    raise exception
      'Homework lesson and teaching occurrence do not match';
  end if;

  return new;
end;
$$;

drop trigger if exists
  validate_homework_teaching_lineage_trigger
on public.homework;

create trigger
  validate_homework_teaching_lineage_trigger
before insert or update of
  teaching_occurrence_id,
  lesson_plan_id,
  teacher_id,
  class_id,
  school_id
on public.homework
for each row
execute function
  public.validate_homework_teaching_lineage();

create or replace view
  public.lesson_evidence_resource_lineage
with (security_invoker = true)
as
select
  leru.lesson_evidence_id,
  leru.teaching_occurrence_id,
  leru.resource_id,
  leru.teacher_id,
  leru.created_at,
  lr.title as resource_title,
  lr.source_type,
  le.lesson_id as lesson_plan_id,
  le.evidence_type,
  le.title as evidence_title
from public.lesson_evidence_resource_usage
  leru
join public.learning_resources lr
  on lr.id = leru.resource_id
join public.lesson_evidence le
  on le.id = leru.lesson_evidence_id;

revoke all on function
  public.link_evidence_to_occurrence_resources(
    uuid,
    uuid
  )
from public, anon;

grant execute on function
  public.link_evidence_to_occurrence_resources(
    uuid,
    uuid
  )
to authenticated, service_role;

grant select on
  public.lesson_evidence_resource_lineage
to authenticated, service_role;

comment on table
  public.lesson_evidence_resource_usage
is
  'Links classroom evidence to resources actually used in the exact teaching occurrence.';

comment on column
  public.homework.teaching_occurrence_id
is
  'Exact teaching occurrence from which this homework was created.';

commit;
