-- Restore production objects that pre-date tracked migration history.
-- authorization-test: public.vc_circulars
-- authorization-test: public.vc_circular_recipients
-- authorization-test: public.finance_fee_structures
-- authorization-test: public.finance_fee_payments

create table if not exists public.vc_circulars (
  id uuid primary key default gen_random_uuid(),
  school_id uuid null references public.schools(id) on delete cascade,
  title text not null,
  body text not null,
  audience_type text not null,
  requires_ack boolean null default true,
  ack_deadline timestamptz null,
  sent_by uuid null references public.profiles(id) on delete set null,
  sent_at timestamptz null default now(),
  created_at timestamptz null default now(),
  recipient_profile_id uuid null references public.profiles(id) on delete set null
);

alter table public.vc_circulars enable row level security;
revoke all on table public.vc_circulars from anon;
revoke all on table public.vc_circulars from authenticated;
grant select, insert, update, delete on table public.vc_circulars to authenticated;
grant all on table public.vc_circulars to service_role;

drop policy if exists vc_circulars_admin on public.vc_circulars;
create policy vc_circulars_admin
  on public.vc_circulars
  for all to authenticated
  using (school_id is not null and public.is_school_admin(school_id))
  with check (school_id is not null and public.is_school_admin(school_id));

drop policy if exists vc_circulars_member_read on public.vc_circulars;
create policy vc_circulars_member_read
  on public.vc_circulars
  for select to authenticated
  using (
    school_id in (
      select sm.school_id
      from public.school_members sm
      where sm.profile_id = (select auth.uid())
    )
    or recipient_profile_id = (select auth.uid())
  );

create table if not exists public.vc_circular_recipients (
  id uuid primary key default gen_random_uuid(),
  circular_id uuid null references public.vc_circulars(id) on delete cascade,
  profile_id uuid null references public.profiles(id) on delete cascade,
  delivered_at timestamptz null default now(),
  ack_at timestamptz null,
  unique (circular_id, profile_id)
);

create index if not exists vc_circular_recipients_profile_idx
  on public.vc_circular_recipients(profile_id, delivered_at desc);

alter table public.vc_circular_recipients enable row level security;
revoke all on table public.vc_circular_recipients from anon;
revoke all on table public.vc_circular_recipients from authenticated;
grant select on table public.vc_circular_recipients to authenticated;
grant update (ack_at) on table public.vc_circular_recipients to authenticated;
grant insert on table public.vc_circular_recipients to authenticated;
grant all on table public.vc_circular_recipients to service_role;

drop policy if exists "recipients can view their circulars" on public.vc_circular_recipients;
create policy "recipients can view their circulars"
  on public.vc_circular_recipients
  for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "recipients can acknowledge" on public.vc_circular_recipients;
create policy "recipients can acknowledge"
  on public.vc_circular_recipients
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists vc_recipients_admin_insert on public.vc_circular_recipients;
create policy vc_recipients_admin_insert
  on public.vc_circular_recipients
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.vc_circulars vc
      where vc.id = vc_circular_recipients.circular_id
        and vc.school_id is not null
        and public.is_school_admin(vc.school_id)
    )
  );

create table if not exists public.finance_fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid null references public.classes(id) on delete cascade,
  term text not null,
  year integer not null,
  label text not null,
  amount numeric not null check (amount >= 0),
  currency text null default 'KES',
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  deleted_at timestamptz null
);

create index if not exists finance_fee_structures_class_idx
  on public.finance_fee_structures(class_id, year, term)
  where deleted_at is null;

alter table public.finance_fee_structures enable row level security;
revoke all on table public.finance_fee_structures from anon;
revoke all on table public.finance_fee_structures from authenticated;
grant select, insert, update, delete on table public.finance_fee_structures to authenticated;
grant all on table public.finance_fee_structures to service_role;

drop policy if exists finance_fee_structures_admin on public.finance_fee_structures;
create policy finance_fee_structures_admin
  on public.finance_fee_structures
  for all to authenticated
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));

drop policy if exists "parent reads fee structures" on public.finance_fee_structures;
create policy "parent reads fee structures"
  on public.finance_fee_structures
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.parent_student_links psl
      join public.students s on s.id = psl.student_id
      where psl.parent_id = (select auth.uid())
        and coalesce(psl.access_level, 'full') <> 'none'
        and coalesce(psl.can_view_finance, false)
        and psl.school_id = finance_fee_structures.school_id
        and s.class_id = finance_fee_structures.class_id
    )
  );

create table if not exists public.finance_fee_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid null references public.schools(id) on delete cascade,
  fee_structure_id uuid null references public.finance_fee_structures(id) on delete set null,
  amount numeric not null check (amount > 0),
  currency text null default 'KES',
  method text null,
  reference text null,
  receipt_url text null,
  term text null,
  year integer null,
  notes text null,
  recorded_at date null default current_date,
  created_at timestamptz null default now(),
  deleted_at timestamptz null
);

create index if not exists finance_fee_payments_student_idx
  on public.finance_fee_payments(student_id, recorded_at desc)
  where deleted_at is null;

alter table public.finance_fee_payments enable row level security;
revoke all on table public.finance_fee_payments from anon;
revoke all on table public.finance_fee_payments from authenticated;
grant select, insert, update, delete on table public.finance_fee_payments to authenticated;
grant all on table public.finance_fee_payments to service_role;

drop policy if exists finance_fee_payments_admin on public.finance_fee_payments;
create policy finance_fee_payments_admin
  on public.finance_fee_payments
  for all to authenticated
  using (school_id is not null and public.is_school_admin(school_id))
  with check (school_id is not null and public.is_school_admin(school_id));

-- This temporary compatibility policy reproduces the pre-R1 production shape.
-- The following R1 migration removes it and moves guardian entries into claims.
drop policy if exists finance_fee_payments_parent_insert on public.finance_fee_payments;
create policy finance_fee_payments_parent_insert
  on public.finance_fee_payments
  for insert to authenticated
  with check (
    (select auth.uid()) = parent_id
    and school_id is not null
    and exists (
      select 1
      from public.parent_student_links psl
      where psl.parent_id = (select auth.uid())
        and psl.student_id = finance_fee_payments.student_id
        and psl.school_id = finance_fee_payments.school_id
        and coalesce(psl.access_level, 'full') <> 'none'
        and coalesce(psl.can_view_finance, false)
    )
  );

drop policy if exists finance_fee_payments_parent_select on public.finance_fee_payments;
create policy finance_fee_payments_parent_select
  on public.finance_fee_payments
  for select to authenticated
  using ((select auth.uid()) = parent_id and deleted_at is null);
