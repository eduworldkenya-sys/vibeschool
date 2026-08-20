-- HQ human operations control plane: durable identity, authority, audit, approvals and offboarding.
create table if not exists public.hq_human_members (
  profile_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('founder','partner_admin','hq_admin','reviewer','support','finance','viewer')),
  status text not null default 'active' check (status in ('invited','setup_required','active','suspended','revoked')),
  display_name text,
  title text,
  department text,
  scope jsonb not null default '{}'::jsonb,
  permissions text[] not null default '{}'::text[],
  access_expires_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hq_human_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  target_id uuid references auth.users(id),
  action text not null,
  before_state jsonb,
  after_state jsonb,
  request_id uuid not null default gen_random_uuid(),
  source text not null default 'human' check (source in ('human','system','worker')),
  created_at timestamptz not null default now()
);
create table if not exists public.hq_human_assignments (
  id uuid primary key default gen_random_uuid(), assignee_id uuid not null references auth.users(id), assigned_by uuid references auth.users(id),
  kind text not null, subject_id text not null, title text not null, status text not null default 'open' check(status in ('open','in_progress','done','cancelled')),
  due_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.hq_human_approvals (
  id uuid primary key default gen_random_uuid(), action_key text not null, subject_id text not null, requested_by uuid not null references auth.users(id),
  required_approvals int not null default 1 check(required_approvals between 1 and 2), approvals jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check(status in ('pending','approved','rejected','expired')), expires_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.hq_human_notification_preferences (
  profile_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{"security":true,"assignments":true,"approvals":true,"content":true,"finance":true,"workforce":true}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hq_human_members enable row level security;
alter table public.hq_human_audit_log enable row level security;
alter table public.hq_human_assignments enable row level security;
alter table public.hq_human_approvals enable row level security;
alter table public.hq_human_notification_preferences enable row level security;
revoke all on public.hq_human_members, public.hq_human_audit_log, public.hq_human_assignments, public.hq_human_approvals, public.hq_human_notification_preferences from anon, authenticated;
grant all on public.hq_human_members, public.hq_human_audit_log, public.hq_human_assignments, public.hq_human_approvals, public.hq_human_notification_preferences to service_role;

-- Seed existing HQ authority without changing the established platform_owners boundary.
insert into public.hq_human_members(profile_id,role,status,created_by)
select profile_id, case when note='hq_partner_admin' then 'partner_admin' else 'founder' end, 'active', profile_id
from public.platform_owners
on conflict(profile_id) do nothing;

create or replace function public.hq_human_is_founder(p_profile_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.hq_human_members where profile_id=p_profile_id and role='founder' and status='active' and (access_expires_at is null or access_expires_at>now()));
$$;
revoke all on function public.hq_human_is_founder(uuid) from public,anon,authenticated;
grant execute on function public.hq_human_is_founder(uuid) to service_role;

create or replace function public.hq_human_has_permission(p_profile_id uuid,p_permission text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.hq_human_members where profile_id=p_profile_id and status='active' and (access_expires_at is null or access_expires_at>now()) and (role='founder' or p_permission=any(permissions)));
$$;
revoke all on function public.hq_human_has_permission(uuid,text) from public,anon,authenticated;
grant execute on function public.hq_human_has_permission(uuid,text) to service_role;

comment on table public.hq_human_audit_log is 'Append-only HQ human authority audit ledger. Application exposes no update/delete path.';
