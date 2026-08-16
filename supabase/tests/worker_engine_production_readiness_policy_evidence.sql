-- Production-readiness adversarial test: authorization must retain exact policy + engine snapshots.
begin;

do $$
declare d text;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_runtime_authorization_events' and column_name='policy_snapshot') then raise exception 'policy_snapshot_column_missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_runtime_authorization_events' and column_name='policy_snapshot_sha256') then raise exception 'policy_snapshot_hash_column_missing'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_runtime_authorization_events' and column_name='engine_contract_snapshot') then raise exception 'engine_contract_snapshot_column_missing'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_bind_runtime_policy_evidence()'::regprocedure)) into d;
  if position('policy_snapshot' in d)=0 or position('sha256' in d)=0 then raise exception 'policy_snapshot_hash_binding_missing'; end if;
  if position('runtime_execution_enabled' in d)=0 or position('runtime_max_concurrency' in d)=0 then raise exception 'engine_contract_snapshot_incomplete'; end if;
end $$;

do $$
begin
  if not exists(select 1 from pg_trigger t where t.tgname='trg_hq_workforce_bind_runtime_policy_evidence' and not t.tgisinternal) then raise exception 'policy_evidence_insert_trigger_missing'; end if;
  if not exists(select 1 from pg_trigger t where t.tgname='trg_hq_workforce_runtime_authorization_events_immutable' and not t.tgisinternal) then raise exception 'authorization_evidence_immutability_trigger_missing'; end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_runtime_authorization_events_immutable()'::regprocedure)) into d;
  if position('append_only' in d)=0 then raise exception 'authorization_evidence_not_append_only'; end if;
end $$;

rollback;
