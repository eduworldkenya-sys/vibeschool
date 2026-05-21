create table if not exists report_schedules (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  created_by    uuid not null references profiles(id) on delete cascade,
  report_type   text not null,
  frequency     text not null check (frequency in ('daily', 'weekly', 'end_of_term')),
  filters       jsonb not null default '{}',
  recipients    text[] not null default '{}',
  is_active     boolean not null default true,
  last_run_at   timestamptz,
  next_run_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table report_schedules enable row level security;

create policy "school members can view schedules"
  on report_schedules for select
  using (school_id in (
    select school_id from profiles where id = auth.uid()
  ));

create policy "school members can insert schedules"
  on report_schedules for insert
  with check (school_id in (
    select school_id from profiles where id = auth.uid()
  ));

create policy "creator can update schedule"
  on report_schedules for update
  using (created_by = auth.uid());

create policy "creator can delete schedule"
  on report_schedules for delete
  using (created_by = auth.uid());
