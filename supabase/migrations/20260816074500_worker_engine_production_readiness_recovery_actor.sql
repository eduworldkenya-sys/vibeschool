-- Worker Engine production-readiness hardening: compensation actor provenance.
-- NON-ACTIVATING. service_role remains transport only; caller labels are metadata, not business identity.

alter table public.hq_workforce_execution_compensations
  add column if not exists transport_request_label text,
  add column if not exists recovery_principal text not null default 'worker-engine-recovery';

create or replace function public.hq_workforce_bind_compensation_actor()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  new.transport_request_label:=new.requested_by;
  new.recovery_principal:='worker-engine-recovery';
  new.requested_by:='worker-engine-recovery';
  new.evidence:=coalesce(new.evidence,'{}'::jsonb)||jsonb_build_object(
    'recovery_principal','worker-engine-recovery',
    'transport_request_label',new.transport_request_label,
    'transport_role',current_user,
    'caller_label_is_authority',false
  );
  return new;
end $$;

revoke all on function public.hq_workforce_bind_compensation_actor() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_bind_compensation_actor on public.hq_workforce_execution_compensations;
create trigger trg_hq_workforce_bind_compensation_actor
before insert on public.hq_workforce_execution_compensations
for each row execute function public.hq_workforce_bind_compensation_actor();

-- Compensation remains governed by failed verification, intent state, authority lineage and exact-state checks.
do $$
declare d text; ec public.hq_workforce_engine_contract%rowtype;
begin
  select lower(pg_get_functiondef('public.hq_workforce_compensate_consequential_execution(uuid,text,text)'::regprocedure)) into d;
  if position('compensation_requires_failed_verification' in d)=0 or position('compensation_authority_lineage_mismatch' in d)=0 then
    raise exception 'recovery actor hardening requires canonical compensation safety contract';
  end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) then
    raise exception 'recovery actor migration changed runtime boundary';
  end if;
end $$;
