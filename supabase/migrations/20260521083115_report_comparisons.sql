create table if not exists report_comparisons (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  created_by    uuid not null references profiles(id) on delete cascade,
  report_type   text not null,
  label         text not null,
  compare_a     jsonb not null,
  compare_b     jsonb not null,
  created_at    timestamptz not null default now()
);

alter table report_comparisons enable row level security;

drop policy if exists "school members can view comparisons" on report_comparisons;
create policy "school members can view comparisons"
  on report_comparisons for select
  using (school_id in (
    select school_id from profiles where id = auth.uid()
  ));

drop policy if exists "school members can insert comparisons" on report_comparisons;
create policy "school members can insert comparisons"
  on report_comparisons for insert
  with check (school_id in (
    select school_id from profiles where id = auth.uid()
  ));

drop policy if exists "creator can delete comparison" on report_comparisons;
create policy "creator can delete comparison"
  on report_comparisons for delete
  using (created_by = auth.uid());
