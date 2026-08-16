-- Worker Engine production-readiness hardening: execution envelope FK ordering correction.
-- NON-ACTIVATING. The canonical execution identity must be created only after its task row exists.

drop trigger if exists trg_hq_workforce_ensure_execution_envelope on public.hq_workforce_task_contracts;
create trigger trg_hq_workforce_ensure_execution_envelope
after insert or update of status on public.hq_workforce_task_contracts
for each row execute function public.hq_workforce_ensure_execution_envelope();

-- Reassert current fail-closed posture.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'execution envelope trigger fix requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'execution envelope trigger fix changed runtime boundary';
  end if;
end $$;
