-- Normalize the minimum read boundary required by the existing School Admin
-- financial reports UI. The UI uses the browser Supabase client, so RLS must
-- explicitly permit school owners/admins to read their own school's ledger data.
-- The historical policies on some finance tables were granted to `public`;
-- replace those with authenticated-only policies. No anonymous access is granted.

begin;

drop policy if exists finance_periods_admin on public.finance_periods;
drop policy if exists finance_accounts_admin on public.finance_accounts;
drop policy if exists finance_transactions_admin on public.finance_transactions;
drop policy if exists finance_transaction_lines_admin on public.finance_transaction_lines;
drop policy if exists finance_invoices_admin on public.finance_invoices;
drop policy if exists finance_payments_admin on public.finance_payments;
drop policy if exists finance_expenses_admin on public.finance_expenses;
drop policy if exists finance_budgets_admin on public.finance_budgets;

drop policy if exists finance_periods_school_admin_select on public.finance_periods;
drop policy if exists finance_accounts_school_admin_select on public.finance_accounts;
drop policy if exists finance_transactions_school_admin_select on public.finance_transactions;
drop policy if exists finance_transaction_lines_school_admin_select on public.finance_transaction_lines;
drop policy if exists finance_invoices_school_admin_select on public.finance_invoices;
drop policy if exists finance_payments_school_admin_select on public.finance_payments;
drop policy if exists finance_expenses_school_admin_select on public.finance_expenses;
drop policy if exists finance_budgets_school_admin_select on public.finance_budgets;

create policy finance_periods_school_admin_select
  on public.finance_periods
  for select
  to authenticated
  using (public.is_school_admin(school_id));

create policy finance_accounts_school_admin_select
  on public.finance_accounts
  for select
  to authenticated
  using (public.is_school_admin(school_id));

create policy finance_transactions_school_admin_select
  on public.finance_transactions
  for select
  to authenticated
  using (public.is_school_admin(school_id));

create policy finance_transaction_lines_school_admin_select
  on public.finance_transaction_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.finance_transactions t
      where t.id = transaction_id
        and public.is_school_admin(t.school_id)
    )
  );

create policy finance_invoices_school_admin_select
  on public.finance_invoices
  for select
  to authenticated
  using (public.is_school_admin(school_id));

create policy finance_payments_school_admin_select
  on public.finance_payments
  for select
  to authenticated
  using (public.is_school_admin(school_id));

create policy finance_expenses_school_admin_select
  on public.finance_expenses
  for select
  to authenticated
  using (public.is_school_admin(school_id));

create policy finance_budgets_school_admin_select
  on public.finance_budgets
  for select
  to authenticated
  using (public.is_school_admin(school_id));

commit;
