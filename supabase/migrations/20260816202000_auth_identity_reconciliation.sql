begin;

-- access: service-only public.auth_identity_reconciliation_findings
-- authorization-test: public.auth_identity_reconciliation_findings anon/authenticated denied; service_role may read/write findings
create table if not exists public.auth_identity_reconciliation_findings (
  finding_key text primary key,
  user_id uuid not null,
  reason_code text not null,
  classification text not null,
  severity text not null check (severity in ('P0','P1','P2','INFO')),
  repairability text not null check (repairability in ('automatic_neutral','manual_proof_required','none')),
  evidence jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.auth_identity_reconciliation_findings enable row level security;
revoke all on table public.auth_identity_reconciliation_findings from public, anon, authenticated;
grant select, insert, update on table public.auth_identity_reconciliation_findings to service_role;

-- access: service-only public.auth_identity_reconciliation_actions
-- authorization-test: public.auth_identity_reconciliation_actions anon/authenticated denied; service_role may append and read recovery evidence
create table if not exists public.auth_identity_reconciliation_actions (
  id uuid primary key default gen_random_uuid(),
  finding_key text,
  user_id uuid not null,
  action_code text not null,
  actor text not null default current_user,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.auth_identity_reconciliation_actions enable row level security;
revoke all on table public.auth_identity_reconciliation_actions from public, anon, authenticated;
grant select, insert on table public.auth_identity_reconciliation_actions to service_role;

create or replace function public.refresh_auth_identity_reconciliation()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_scan timestamptz := clock_timestamp();
  v_open integer;
begin
  -- Missing profile is the only automatically repairable class, and repair is authority-neutral.
  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'AUTH_PROFILE_MISSING:'||u.id,u.id,'AUTH_PROFILE_MISSING','recoverable_partial_provisioning','P1','automatic_neutral',
         jsonb_build_object('created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,
           'providers',coalesce((select jsonb_agg(i.provider order by i.provider) from auth.identities i where i.user_id=u.id),'[]'::jsonb)),
         v_scan,null
  from auth.users u left join public.profiles p on p.id=u.id
  where p.id is null
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'STUDENT_DOMAIN_MISSING:'||p.id,p.id,'STUDENT_DOMAIN_MISSING','orphaned_domain_relation','P1','manual_proof_required',
         jsonb_build_object('account_status',p.account_status::text,'profile_school_id',p.school_id),v_scan,null
  from public.profiles p
  left join public.students s on s.profile_id=p.id and s.deleted_at is null
  where p.role='student' and p.account_status::text='active' and not p.is_anonymized and s.id is null
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'ADMIN_MEMBERSHIP_MISSING:'||p.id,p.id,'ADMIN_MEMBERSHIP_MISSING',
         case when p.account_status::text='active' and not p.is_anonymized then 'invalid_authority_state' else 'legacy_historical_state' end,
         case when p.account_status::text='active' and not p.is_anonymized then 'P0' else 'P1' end,
         'manual_proof_required',
         jsonb_build_object('account_status',p.account_status::text,'is_anonymized',p.is_anonymized,'profile_school_id',p.school_id),v_scan,null
  from public.profiles p
  where p.role='admin' and not exists(
    select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text in ('admin','owner')
  )
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  with linked as (
    select i.user_id,count(*) identity_count,count(distinct i.provider) provider_count,
           array_agg(i.provider order by i.provider) providers
    from auth.identities i group by i.user_id having count(*)>1
  )
  insert into public.auth_identity_reconciliation_findings(
    finding_key,user_id,reason_code,classification,severity,repairability,evidence,last_seen_at,resolved_at
  )
  select 'MULTI_PROVIDER_IDENTITY:'||l.user_id,l.user_id,'MULTI_PROVIDER_IDENTITY',
         case when l.identity_count=2 and l.provider_count=2 and l.providers=array['email','google']::text[]
              then 'valid_linked_identity' else 'manual_review_required' end,
         case when l.identity_count=2 and l.provider_count=2 and l.providers=array['email','google']::text[] then 'INFO' else 'P1' end,
         case when l.identity_count=2 and l.provider_count=2 and l.providers=array['email','google']::text[] then 'none' else 'manual_proof_required' end,
         jsonb_build_object('providers',l.providers,'identity_count',l.identity_count),v_scan,null
  from linked l
  on conflict(finding_key) do update set classification=excluded.classification,severity=excluded.severity,
    repairability=excluded.repairability,evidence=excluded.evidence,last_seen_at=excluded.last_seen_at,resolved_at=null;

  update public.auth_identity_reconciliation_findings
  set resolved_at=v_scan
  where resolved_at is null and last_seen_at < v_scan;

  select count(*) into v_open from public.auth_identity_reconciliation_findings where resolved_at is null;
  return jsonb_build_object('scan_started_at',v_scan,'open_findings',v_open);
end;
$$;
revoke all on function public.refresh_auth_identity_reconciliation() from public, anon, authenticated;
grant execute on function public.refresh_auth_identity_reconciliation() to service_role;

create or replace function public.repair_missing_neutral_profile(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_user auth.users%rowtype;
begin
  select * into v_user from auth.users where id=p_user_id for update;
  if not found then raise exception 'auth_user_not_found' using errcode='P0002'; end if;
  if exists(select 1 from public.profiles where id=p_user_id) then return false; end if;

  insert into public.profiles(id,full_name,role,account_status)
  values(p_user_id,coalesce(v_user.raw_user_meta_data->>'full_name',''),null,'active'::account_status);

  insert into public.auth_identity_reconciliation_actions(finding_key,user_id,action_code,evidence)
  values('AUTH_PROFILE_MISSING:'||p_user_id,p_user_id,'CREATE_NEUTRAL_PROFILE',
         jsonb_build_object('role',null,'authority_granted',false));

  update public.auth_identity_reconciliation_findings
  set resolved_at=now(),last_seen_at=now()
  where finding_key='AUTH_PROFILE_MISSING:'||p_user_id;
  return true;
end;
$$;
revoke all on function public.repair_missing_neutral_profile(uuid) from public, anon, authenticated;
grant execute on function public.repair_missing_neutral_profile(uuid) to service_role;

-- Admin is a privileged domain role: profile role without admin/owner membership is not authority.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select case
    when p.account_status::text <> 'active' or p.is_anonymized then null
    when p.role='admin' and not exists(
      select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text in ('admin','owner')
    ) then null
    when p.role in ('teacher','parent','student','admin','global_user') then p.role
    else null
  end
  from public.profiles p where p.id=auth.uid() limit 1;
$$;
revoke all on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated, service_role;

create or replace function public.get_my_auth_access_state()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select case when auth.uid() is null then
    jsonb_build_object('authenticated',false,'role',null,'account_status',null,'is_anonymized',false,
      'profile_complete',false,'authority_complete',false,'reason_code','AUTHENTICATION_REQUIRED')
  else coalesce((select jsonb_build_object(
      'authenticated',true,
      'role',case
        when p.account_status::text <> 'active' or p.is_anonymized then null
        when p.role='admin' and not exists(
          select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text in ('admin','owner')
        ) then null else p.role end,
      'account_status',p.account_status::text,
      'is_anonymized',p.is_anonymized,
      'profile_complete',p.role is not null,
      'authority_complete',case when p.role='admin' then exists(
        select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text in ('admin','owner')
      ) else p.role is not null end,
      'reason_code',case
        when p.account_status::text <> 'active' then 'ACCOUNT_NOT_ACTIVE'
        when p.is_anonymized then 'ACCOUNT_ANONYMIZED'
        when p.role is null then 'ROLE_UNCLAIMED'
        when p.role='admin' and not exists(
          select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text in ('admin','owner')
        ) then 'ADMIN_MEMBERSHIP_MISSING'
        else 'OK' end
    ) from public.profiles p where p.id=auth.uid() limit 1),
    jsonb_build_object('authenticated',true,'role',null,'account_status',null,'is_anonymized',false,
      'profile_complete',false,'authority_complete',false,'reason_code','PROFILE_MISSING')) end;
$$;
revoke all on function public.get_my_auth_access_state() from public, anon;
grant execute on function public.get_my_auth_access_state() to authenticated, service_role;

comment on table public.auth_identity_reconciliation_findings is 'Evidence-only identity integrity ledger; findings never grant authority.';
comment on function public.refresh_auth_identity_reconciliation() is 'Service-only idempotent identity integrity scan; does not mutate user authority.';
comment on function public.repair_missing_neutral_profile(uuid) is 'Service-only repair that creates role=NULL and grants no authority.';

commit;
