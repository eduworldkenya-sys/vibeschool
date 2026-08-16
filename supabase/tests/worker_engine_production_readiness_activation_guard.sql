-- Production-readiness adversarial test: runtime cannot turn ON by defaults/fallback policy.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_guard_runtime_activation()'::regprocedure)) into d;
  if position('runtime_activation_requires_exactly_one_active_global_policy' in d)=0 then raise exception 'global_policy_activation_gate_missing'; end if;
  if position('runtime_activation_requires_explicit_capability_authority' in d)=0 then raise exception 'authority_activation_gate_missing'; end if;
  if position('runtime_activation_requires_explicit_shadow_stop_clearance' in d)=0 then raise exception 'shadow_stop_activation_gate_missing'; end if;
  if not exists(
    select 1 from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='hq_workforce_engine_contract'
      and tg.tgname='trg_hq_workforce_guard_runtime_activation' and not tg.tgisinternal
  ) then raise exception 'runtime_activation_guard_trigger_missing'; end if;
end $$;

-- With the certified baseline (zero active policies/authority), activation must fail closed.
do $$
begin
  begin
    update public.hq_workforce_engine_contract set runtime_execution_enabled=true where singleton=true;
    raise exception 'runtime_activation_unexpectedly_succeeded';
  exception when others then
    if sqlerrm='runtime_activation_unexpectedly_succeeded' then raise; end if;
    if position('runtime_activation_requires_' in sqlerrm)=0 then raise exception 'unexpected_activation_denial:%',sqlerrm; end if;
  end;
end $$;

rollback;
