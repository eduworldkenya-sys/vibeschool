begin;

-- Defense in depth for sensitive parent data. UI/RPC checks are not the boundary;
-- these policies ensure direct PostgREST access cannot cross the parent-child link.

alter table public.health_records enable row level security;
alter table public.health_vaccinations enable row level security;
alter table public.finance_fee_payments enable row level security;
alter table public.finance_pocket_money enable row level security;
alter table public.finance_savings_goals enable row level security;
alter table public.finance_savings_contributions enable row level security;

create policy parent_health_records_select
on public.health_records for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = health_records.student_id and coalesce(psl.access_level, 'full') <> 'none'));

create policy parent_health_records_insert
on public.health_records for insert to authenticated
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = health_records.student_id and coalesce(psl.access_level, 'full') <> 'none'));

create policy parent_health_records_update
on public.health_records for update to authenticated
using (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = health_records.student_id and coalesce(psl.access_level, 'full') <> 'none'))
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = health_records.student_id and coalesce(psl.access_level, 'full') <> 'none'));

create policy parent_health_vaccinations_select
on public.health_vaccinations for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = health_vaccinations.student_id and coalesce(psl.access_level, 'full') <> 'none'));

create policy parent_health_vaccinations_insert
on public.health_vaccinations for insert to authenticated
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = health_vaccinations.student_id and coalesce(psl.access_level, 'full') <> 'none'));

create policy parent_health_vaccinations_update
on public.health_vaccinations for update to authenticated
using (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = health_vaccinations.student_id and coalesce(psl.access_level, 'full') <> 'none'))
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = health_vaccinations.student_id and coalesce(psl.access_level, 'full') <> 'none'));

create policy parent_finance_fee_select
on public.finance_fee_payments for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_fee_payments.student_id and coalesce(psl.access_level, 'full') <> 'none'));
create policy parent_finance_fee_insert
on public.finance_fee_payments for insert to authenticated
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_fee_payments.student_id and coalesce(psl.access_level, 'full') <> 'none'));
create policy parent_finance_fee_update
on public.finance_fee_payments for update to authenticated
using (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_fee_payments.student_id and coalesce(psl.access_level, 'full') <> 'none'))
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_fee_payments.student_id and coalesce(psl.access_level, 'full') <> 'none'));

create policy parent_finance_pocket_select
on public.finance_pocket_money for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_pocket_money.student_id and coalesce(psl.access_level, 'full') <> 'none'));
create policy parent_finance_pocket_insert
on public.finance_pocket_money for insert to authenticated
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_pocket_money.student_id and coalesce(psl.access_level, 'full') <> 'none'));
create policy parent_finance_pocket_update
on public.finance_pocket_money for update to authenticated
using (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_pocket_money.student_id and coalesce(psl.access_level, 'full') <> 'none'))
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_pocket_money.student_id and coalesce(psl.access_level, 'full') <> 'none'));

create policy parent_finance_goal_select
on public.finance_savings_goals for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_savings_goals.student_id and coalesce(psl.access_level, 'full') <> 'none'));
create policy parent_finance_goal_insert
on public.finance_savings_goals for insert to authenticated
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_savings_goals.student_id and coalesce(psl.access_level, 'full') <> 'none'));
create policy parent_finance_goal_update
on public.finance_savings_goals for update to authenticated
using (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_savings_goals.student_id and coalesce(psl.access_level, 'full') <> 'none'))
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_savings_goals.student_id and coalesce(psl.access_level, 'full') <> 'none'));

create policy parent_finance_contribution_select
on public.finance_savings_contributions for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_savings_contributions.student_id and coalesce(psl.access_level, 'full') <> 'none'));
create policy parent_finance_contribution_insert
on public.finance_savings_contributions for insert to authenticated
with check (parent_id = auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id = auth.uid() and psl.student_id = finance_savings_contributions.student_id and coalesce(psl.access_level, 'full') <> 'none'));

commit;
