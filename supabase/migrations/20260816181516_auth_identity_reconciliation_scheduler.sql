create table if not exists public.auth_identity_reconciliation_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  open_findings integer,
  p0_findings integer,
  p1_findings integer,
  info_findings integer,
  result jsonb not null default '{}'::jsonb
);

alter table public.auth_identity_reconciliation_runs enable row level security;
revoke all on table public.auth_identity_reconciliation_runs from public, anon, authenticated;
grant select, insert, update on table public.auth_identity_reconciliation_runs to service_role;

create or replace function public.run_auth_identity_reconciliation_cycle()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_result jsonb;
  v_open integer;
  v_p0 integer;
  v_p1 integer;
  v_info integer;
  v_id bigint;
begin
  insert into public.auth_identity_reconciliation_runs default values returning id into v_id;
  v_result := public.refresh_auth_identity_reconciliation();
  select count(*) into v_open from public.auth_identity_reconciliation_findings where resolved_at is null;
  select count(*) into v_p0 from public.auth_identity_reconciliation_findings where resolved_at is null and severity='P0';
  select count(*) into v_p1 from public.auth_identity_reconciliation_findings where resolved_at is null and severity='P1';
  select count(*) into v_info from public.auth_identity_reconciliation_findings where resolved_at is null and severity='INFO';
  update public.auth_identity_reconciliation_runs
     set completed_at=now(),open_findings=v_open,p0_findings=v_p0,p1_findings=v_p1,info_findings=v_info,
         result=v_result || jsonb_build_object('p0_findings',v_p0,'p1_findings',v_p1,'info_findings',v_info)
   where id=v_id;
  return v_result || jsonb_build_object('run_id',v_id,'p0_findings',v_p0,'p1_findings',v_p1,'info_findings',v_info);
end;
$function$;

revoke all on function public.run_auth_identity_reconciliation_cycle() from public, anon, authenticated;
grant execute on function public.run_auth_identity_reconciliation_cycle() to service_role;

create extension if not exists pg_cron with schema pg_catalog;

do $do$
begin
  if exists (select 1 from cron.job where jobname='vibeschool-auth-identity-reconciliation') then
    perform cron.unschedule('vibeschool-auth-identity-reconciliation');
  end if;
  perform cron.schedule(
    'vibeschool-auth-identity-reconciliation',
    '17 * * * *',
    'select public.run_auth_identity_reconciliation_cycle();'
  );
end
$do$;
