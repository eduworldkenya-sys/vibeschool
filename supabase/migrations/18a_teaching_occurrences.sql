create table if not exists public.teaching_occurrences (
  id                     uuid primary key default gen_random_uuid(),
  timetable_slot_id      uuid not null references public.timetable_slots(id) on delete restrict,
  occurrence_date        date not null,
  school_id              uuid not null references public.schools(id) on delete cascade,
  teacher_id             uuid not null references public.profiles(id) on delete cascade,
  class_id               uuid not null references public.classes(id) on delete restrict,
  subject_id             uuid not null references public.subjects(id) on delete restrict,

  lifecycle              text not null default 'planned'
                          check (lifecycle in (
                            'planned','ready','in_progress','completed',
                            'missed','cancelled','rescheduled'
                          )),

  started_at             timestamptz,
  completed_at           timestamptz,

  cancelled_reason       text,
  cancelled_at           timestamptz,

  rescheduled_to_slot_id uuid references public.timetable_slots(id) on delete restrict,
  rescheduled_to_date    date,
  recovered_from_id      uuid references public.teaching_occurrences(id) on delete set null,

  created_at             timestamptz not null default clock_timestamp(),
  updated_at             timestamptz not null default clock_timestamp(),

  constraint teaching_occurrences_slot_date_unique unique (timetable_slot_id, occurrence_date),
  constraint teaching_occurrences_cancel_reason_check
    check (lifecycle != 'cancelled' or cancelled_reason is not null),
  constraint teaching_occurrences_reschedule_target_check
    check (lifecycle != 'rescheduled' or (rescheduled_to_slot_id is not null and rescheduled_to_date is not null))
);

create index if not exists idx_teaching_occurrences_teacher on public.teaching_occurrences(teacher_id);
create index if not exists idx_teaching_occurrences_class on public.teaching_occurrences(class_id);
create index if not exists idx_teaching_occurrences_date on public.teaching_occurrences(occurrence_date);

create or replace function public.trg_teaching_occurrences_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists set_teaching_occurrences_updated_at on public.teaching_occurrences;
create trigger set_teaching_occurrences_updated_at
  before update on public.teaching_occurrences
  for each row execute function public.trg_teaching_occurrences_updated_at();

alter table public.teaching_occurrences enable row level security;

create policy teaching_occurrences_teacher_read
  on public.teaching_occurrences for select
  using (teacher_id = auth.uid());

create policy teaching_occurrences_admin_read
  on public.teaching_occurrences for select
  using (is_school_admin(school_id));

create policy teaching_occurrences_teacher_write
  on public.teaching_occurrences for insert
  with check (teacher_id = auth.uid());

create policy teaching_occurrences_teacher_update
  on public.teaching_occurrences for update
  using (teacher_id = auth.uid());

create policy teaching_occurrences_no_delete
  on public.teaching_occurrences for delete
  using (false);
