-- Task 7 least-privilege closure for School OS operational and finance relations.
--
-- finance_invoices and finance_payments exist in production but their creation predates
-- the repository's reconstructable migration history. Restore their canonical core shape
-- here before applying the Task 7 privilege closure so a zero-state rebuild is complete.
-- CREATE TABLE IF NOT EXISTS is intentionally a no-op on production, where these relations
-- already exist; this migration must not replace or broaden production authority.
-- authorization-test: public.academic_terms
-- authorization-test: public.exams
-- authorization-test: public.finance_invoices
-- authorization-test: public.finance_payments
-- authorization-test: public.subjects
-- authorization-test: public.timetable_slots

begin;

create table if not exists public.finance_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id),
  class_id uuid references public.classes(id),
  term text not null,
  year integer not null,
  due_date date,
  status text not null default 'issued' check (status in ('draft', 'issued', 'partial', 'paid', 'overdue', 'waived')),
  total_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  constraint finance_invoices_amounts_valid check (
    total_amount >= 0 and paid_amount >= 0 and paid_amount <= total_amount
  )
);

create table if not exists public.finance_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  invoice_id uuid not null references public.finance_invoices(id),
  student_id uuid not null references public.students(id),
  amount numeric(14,2) not null constraint finance_payments_amount_positive check (amount > 0),
  method text not null check (method in ('mpesa', 'cash', 'bank', 'cheque')),
  reference text,
  receipt_number text unique,
  received_by uuid references public.profiles(id),
  received_at timestamptz default now(),
  transaction_id uuid,
  bank_account_id uuid,
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- Preserve production foreign-key semantics when the older finance subsystem has also
-- been reconstructed. Those legacy finance relations are themselves production-only in
-- the current repository history, so a clean rebuild must not depend on them existing.
do $$
begin
  if to_regclass('public.finance_transactions') is not null
     and not exists (select 1 from pg_constraint where conname = 'finance_payments_transaction_id_fkey') then
    alter table public.finance_payments
      add constraint finance_payments_transaction_id_fkey
      foreign key (transaction_id) references public.finance_transactions(id);
  end if;

  if to_regclass('public.finance_bank_accounts') is not null
     and not exists (select 1 from pg_constraint where conname = 'finance_payments_bank_account_id_fkey') then
    alter table public.finance_payments
      add constraint finance_payments_bank_account_id_fkey
      foreign key (bank_account_id) references public.finance_bank_accounts(id);
  end if;
end
$$;

alter table public.finance_invoices enable row level security;
alter table public.finance_payments enable row level security;

-- Reconstruct only the authenticated authority required by the existing School OS.
-- RLS remains the row-level authorization boundary; anonymous access is explicitly closed below.
grant select, insert, update, delete on table public.finance_invoices to authenticated;
grant select, insert, update, delete on table public.finance_payments to authenticated;
grant all privileges on table public.finance_invoices to service_role;
grant all privileges on table public.finance_payments to service_role;

drop policy if exists finance_invoices_admin on public.finance_invoices;
create policy finance_invoices_admin
  on public.finance_invoices
  for all to authenticated
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));

drop policy if exists finance_invoices_parent on public.finance_invoices;
create policy finance_invoices_parent
  on public.finance_invoices
  for select to authenticated
  using (
    exists (
      select 1
      from public.parent_student_links psl
      where psl.parent_id = (select auth.uid())
        and psl.student_id = finance_invoices.student_id
        and coalesce(psl.access_level, 'full') <> 'none'
        and coalesce(psl.can_view_finance, false)
    )
  );

drop policy if exists finance_invoices_student_read on public.finance_invoices;
create policy finance_invoices_student_read
  on public.finance_invoices
  for select to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = finance_invoices.student_id
        and s.profile_id = (select auth.uid())
    )
  );

drop policy if exists finance_payments_admin on public.finance_payments;
create policy finance_payments_admin
  on public.finance_payments
  for all to authenticated
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));

drop policy if exists finance_payments_parent on public.finance_payments;
create policy finance_payments_parent
  on public.finance_payments
  for select to authenticated
  using (
    exists (
      select 1
      from public.parent_student_links psl
      where psl.parent_id = (select auth.uid())
        and psl.student_id = finance_payments.student_id
        and coalesce(psl.access_level, 'full') <> 'none'
        and coalesce(psl.can_view_finance, false)
    )
  );

revoke all privileges on table public.academic_terms from anon;
revoke all privileges on table public.exams from anon;
revoke all privileges on table public.finance_invoices from anon;
revoke all privileges on table public.finance_payments from anon;
revoke all privileges on table public.subjects from anon;
revoke all privileges on table public.timetable_slots from anon;

-- PUBLIC must not be an alternate path back to these authenticated relations.
revoke all privileges on table public.academic_terms from public;
revoke all privileges on table public.exams from public;
revoke all privileges on table public.finance_invoices from public;
revoke all privileges on table public.finance_payments from public;
revoke all privileges on table public.subjects from public;
revoke all privileges on table public.timetable_slots from public;

commit;
