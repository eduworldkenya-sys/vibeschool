-- Task 5 prerequisite: restore the notifications relation that exists in
-- production but was missing from the repository migration chain.
-- This is reconstruction-only on the branch; production is not mutated here.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid null references public.schools(id),
  user_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  type text not null,
  related_id uuid null,
  is_read boolean default false,
  created_at timestamptz default now(),
  deleted_at timestamptz null,
  constraint notifications_type_check check (
    type = any (array[
      'fee_payment'::text,
      'fee_reminder'::text,
      'attendance'::text,
      'announcement'::text,
      'leave'::text,
      'general'::text,
      'homework_submitted'::text,
      'homework_assigned'::text,
      'assessment_available'::text,
      'homework_feedback'::text,
      'assessment_result'::text
    ])
  )
);

alter table public.notifications enable row level security;

-- Reconstruct the production access model while keeping anonymous callers
-- non-executable at the table privilege layer.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notifications' and policyname='notifications_own_read'
  ) then
    create policy notifications_own_read on public.notifications
      for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notifications' and policyname='notifications_own_update'
  ) then
    create policy notifications_own_update on public.notifications
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notifications' and policyname='notifications_admin_insert'
  ) then
    create policy notifications_admin_insert on public.notifications
      for insert to authenticated
      with check (
        exists (
          select 1 from public.school_members sm
          where sm.profile_id = auth.uid()
            and sm.school_id = notifications.school_id
            and sm.role = 'admin'::public.member_role
        )
      );
  end if;
end
$$;

revoke all on table public.notifications from public, anon;
grant select, insert, update on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc)
  where deleted_at is null;

comment on table public.notifications is
  'Repository-restored learner/account notification inbox prerequisite; RLS scopes authenticated readers to their own profile.';
