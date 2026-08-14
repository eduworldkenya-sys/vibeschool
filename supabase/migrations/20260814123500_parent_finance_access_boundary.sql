begin;

-- Finance is sensitive family data. The browser may provide a child id,
-- but authorization must come from the authenticated parent relationship.

alter table if exists public.finance_fee_payments enable row level security;
alter table if exists public.finance_pocket_money enable row level security;
alter table if exists public.finance_savings_goals enable row level security;
alter table if exists public.finance_savings_contributions enable row level security;

create or replace function public.parent_has_full_child_access(p_student_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = p_student_id
      and coalesce(psl.access_level, 'full') = 'full'
  );
$$;

revoke all on function public.parent_has_full_child_access(uuid) from public, anon;
grant execute on function public.parent_has_full_child_access(uuid) to authenticated;

drop policy if exists parent_finance_fee_select on public.finance_fee_payments;
drop policy if exists parent_finance_fee_insert on public.finance_fee_payments;
drop policy if exists parent_finance_pocket_select on public.finance_pocket_money;
drop policy if exists parent_finance_pocket_insert on public.finance_pocket_money;
drop policy if exists parent_finance_goals_select on public.finance_savings_goals;
drop policy if exists parent_finance_goals_insert on public.finance_savings_goals;
drop policy if exists parent_finance_goals_update on public.finance_savings_goals;
drop policy if exists parent_finance_contrib_select on public.finance_savings_contributions;
drop policy if exists parent_finance_contrib_insert on public.finance_savings_contributions;

create policy parent_finance_fee_select on public.finance_fee_payments
for select to authenticated using (parent_id = auth.uid() and public.parent_has_full_child_access(student_id));
create policy parent_finance_fee_insert on public.finance_fee_payments
for insert to authenticated with check (parent_id = auth.uid() and public.parent_has_full_child_access(student_id));

create policy parent_finance_pocket_select on public.finance_pocket_money
for select to authenticated using (parent_id = auth.uid() and public.parent_has_full_child_access(student_id));
create policy parent_finance_pocket_insert on public.finance_pocket_money
for insert to authenticated with check (parent_id = auth.uid() and public.parent_has_full_child_access(student_id));

create policy parent_finance_goals_select on public.finance_savings_goals
for select to authenticated using (parent_id = auth.uid() and public.parent_has_full_child_access(student_id));
create policy parent_finance_goals_insert on public.finance_savings_goals
for insert to authenticated with check (parent_id = auth.uid() and public.parent_has_full_child_access(student_id));
create policy parent_finance_goals_update on public.finance_savings_goals
for update to authenticated using (parent_id = auth.uid() and public.parent_has_full_child_access(student_id))
with check (parent_id = auth.uid() and public.parent_has_full_child_access(student_id));

create policy parent_finance_contrib_select on public.finance_savings_contributions
for select to authenticated using (parent_id = auth.uid() and public.parent_has_full_child_access(student_id));
create policy parent_finance_contrib_insert on public.finance_savings_contributions
for insert to authenticated with check (parent_id = auth.uid() and public.parent_has_full_child_access(student_id));

commit;
