-- A1: curriculum_content becomes a library, not a 1:1 record
alter table curriculum_content drop constraint if exists curriculum_content_curriculum_id_key;
alter table curriculum_content add column if not exists source_type text not null default 'kicd'
  check (source_type in ('kicd','publisher','school_authored'));
alter table curriculum_content add column if not exists publisher_name text;
alter table curriculum_content add column if not exists school_id uuid references schools(id) on delete set null;
create unique index if not exists uq_curriculum_content_kicd_default
  on curriculum_content(curriculum_id) where source_type = 'kicd';

-- A2: content preference (school default + optional teacher override)
create table if not exists content_preferences (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references schools(id) on delete cascade,
  subject_id            uuid not null references subjects(id) on delete cascade,
  teacher_id            uuid references profiles(id) on delete cascade,
  curriculum_content_id uuid not null references curriculum_content(id) on delete cascade,
  created_at            timestamptz default now()
);
create unique index if not exists uq_content_pref_school_default
  on content_preferences(school_id, subject_id) where teacher_id is null;
create unique index if not exists uq_content_pref_teacher_override
  on content_preferences(school_id, subject_id, teacher_id) where teacher_id is not null;

alter table content_preferences enable row level security;
create policy "teacher manages own override" on content_preferences
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "admin manages school default" on content_preferences
  for all using (
    teacher_id is null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.school_id = content_preferences.school_id
        and p.role in ('admin', 'head_teacher')
    )
  )
  with check (
    teacher_id is null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.school_id = content_preferences.school_id
        and p.role in ('admin', 'head_teacher')
    )
  );

-- A3: scheme_of_work un-deprecated, TSC-mandated columns added
comment on table scheme_of_work is null;
alter table scheme_of_work add column if not exists lesson_number int;
alter table scheme_of_work add column if not exists reflection text;
alter table scheme_of_work add column if not exists curriculum_content_id uuid references curriculum_content(id) on delete set null;

-- A4: lesson_plans.curriculum_id becomes derived from scheme_id
alter table lesson_plans add column if not exists scheme_id uuid
  references scheme_of_work(id) on delete set null;

create or replace function sync_lesson_plan_curriculum_from_scheme()
returns trigger language plpgsql as $$
begin
  if NEW.scheme_id is not null then
    select curriculum_id into NEW.curriculum_id from scheme_of_work where id = NEW.scheme_id;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_sync_lesson_plan_curriculum on lesson_plans;
create trigger trg_sync_lesson_plan_curriculum
  before insert or update of scheme_id on lesson_plans
  for each row execute function sync_lesson_plan_curriculum_from_scheme();
