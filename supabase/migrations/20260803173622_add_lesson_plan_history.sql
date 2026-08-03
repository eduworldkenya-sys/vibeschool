-- History table: append-only audit log of lesson_plans row states
create table if not exists lesson_plan_history (
  id uuid primary key default gen_random_uuid(),
  lesson_plan_id uuid not null references lesson_plans(id) on delete cascade,
  school_id uuid,
  teacher_id uuid not null,
  change_type text not null,
  status text not null,
  snapshot jsonb not null,
  changed_by uuid,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_lesson_plan_history_plan
  on lesson_plan_history (lesson_plan_id, created_at desc);

alter table lesson_plan_history enable row level security;

create policy pol_lesson_plan_history_select on lesson_plan_history
for select
using (
  teacher_id = auth.uid()
  or exists (
    select 1
    from school_members
    where school_members.school_id = lesson_plan_history.school_id
      and school_members.profile_id = auth.uid()
      and school_members.role = any (
        array['owner'::member_role, 'admin'::member_role]
      )
  )
);

-- Trigger function: snapshot OLD row before every update
create or replace function log_lesson_plan_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into lesson_plan_history (
    lesson_plan_id,
    school_id,
    teacher_id,
    change_type,
    status,
    snapshot,
    changed_by
  )
  values (
    OLD.id,
    OLD.school_id,
    OLD.teacher_id,
    case
      when OLD.status is distinct from NEW.status then 'status_change'
      else 'edit'
    end,
    OLD.status,
    to_jsonb(OLD),
    auth.uid()
  );

  return NEW;
end;
$$;

revoke all on function log_lesson_plan_history()
from public, anon, authenticated;

drop trigger if exists trg_lesson_plan_history on lesson_plans;

create trigger trg_lesson_plan_history
after update on lesson_plans
for each row
when (OLD.* is distinct from NEW.*)
execute function log_lesson_plan_history();
