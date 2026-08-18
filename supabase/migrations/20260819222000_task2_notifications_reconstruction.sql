-- Task 2: recover the production-only notifications relation into repository truth.
-- authorization-test: public.notifications
--
-- Production already contains public.notifications and live data. A blank repository
-- rebuild did not, while the student application directly depends on this contract.
-- This forward migration therefore follows expand/reconcile semantics:
--   * create the relation only when it is genuinely absent (blank reconstruction)
--   * assert the existing production shape before touching security
--   * canonicalize RLS/policies/grants without deleting or rewriting notification data

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  user_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  type text not null check (
    type = any (array[
      'fee_payment'::text,
      'fee_reminder'::text,
      'attendance'::text,
      'announcement'::text,
      'leave'::text,
      'general'::text,
      'homework_submitted'::text
    ])
  ),
  related_id uuid,
  is_read boolean default false,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- Refuse to silently bless a production table with an incompatible contract.
do $$
declare
  mismatch text[];
begin
  with expected(column_name, udt_name, is_nullable) as (
    values
      ('id','uuid','NO'),
      ('school_id','uuid','YES'),
      ('user_id','uuid','NO'),
      ('title','text','NO'),
      ('body','text','NO'),
      ('type','text','NO'),
      ('related_id','uuid','YES'),
      ('is_read','bool','YES'),
      ('created_at','timestamptz','YES'),
      ('deleted_at','timestamptz','YES')
  )
  select array_agg(e.column_name order by e.column_name)
  into mismatch
  from expected e
  left join information_schema.columns c
    on c.table_schema='public'
   and c.table_name='notifications'
   and c.column_name=e.column_name
  where c.column_name is null
     or c.udt_name<>e.udt_name
     or c.is_nullable<>e.is_nullable;

  if mismatch is not null then
    raise exception 'notifications contract mismatch for columns: %', array_to_string(mismatch, ', ');
  end if;
end $$;

alter table public.notifications enable row level security;

-- Canonical policies match the live application contract while remaining scoped.
drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read
on public.notifications
for select
using (user_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.school_members sm
    where sm.profile_id = auth.uid()
      and sm.role = 'admin'::public.member_role
  )
);

-- RLS remains the row boundary, but anonymous users do not need table privileges at
-- all for this authenticated application surface. Remove legacy broad grants.
revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;
grant select, insert, update on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

comment on table public.notifications is
  'Canonical user notification inbox. Recovered into repository truth by Task 2 after zero-to-current reconstruction exposed the former production-only dependency.';
