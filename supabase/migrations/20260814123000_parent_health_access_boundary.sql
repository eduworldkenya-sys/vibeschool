begin;

-- Health is sensitive parent data. Enforce the relationship at the table boundary
-- so changing a child id in the browser cannot bypass the parent relationship.
alter table if exists public.health_records enable row level security;
alter table if exists public.health_vaccinations enable row level security;

drop policy if exists parent_health_records_select on public.health_records;
drop policy if exists parent_health_records_insert on public.health_records;
drop policy if exists parent_health_records_update on public.health_records;
drop policy if exists parent_health_records_delete on public.health_records;

drop policy if exists parent_health_vaccinations_select on public.health_vaccinations;
drop policy if exists parent_health_vaccinations_insert on public.health_vaccinations;
drop policy if exists parent_health_vaccinations_update on public.health_vaccinations;
drop policy if exists parent_health_vaccinations_delete on public.health_vaccinations;

create policy parent_health_records_select
on public.health_records for select to authenticated
using (
  parent_id = auth.uid()
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = health_records.student_id
      and coalesce(psl.access_level, 'full') <> 'none'
  )
);

create policy parent_health_records_insert
on public.health_records for insert to authenticated
with check (
  parent_id = auth.uid()
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = health_records.student_id
      and coalesce(psl.access_level, 'full') = 'full'
  )
);

create policy parent_health_records_update
on public.health_records for update to authenticated
using (parent_id = auth.uid())
with check (parent_id = auth.uid());

create policy parent_health_records_delete
on public.health_records for delete to authenticated
using (parent_id = auth.uid());

create policy parent_health_vaccinations_select
on public.health_vaccinations for select to authenticated
using (
  parent_id = auth.uid()
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = health_vaccinations.student_id
      and coalesce(psl.access_level, 'full') <> 'none'
  )
);

create policy parent_health_vaccinations_insert
on public.health_vaccinations for insert to authenticated
with check (
  parent_id = auth.uid()
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = health_vaccinations.student_id
      and coalesce(psl.access_level, 'full') = 'full'
  )
);

create policy parent_health_vaccinations_update
on public.health_vaccinations for update to authenticated
using (parent_id = auth.uid())
with check (parent_id = auth.uid());

create policy parent_health_vaccinations_delete
on public.health_vaccinations for delete to authenticated
using (parent_id = auth.uid());

commit;
