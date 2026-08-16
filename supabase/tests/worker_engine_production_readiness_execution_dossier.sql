-- Production-readiness adversarial test: canonical execution identity and owner-only dossier.
begin;

do $$
declare d text;
begin
  if has_table_privilege('authenticated','public.hq_workforce_execution_envelopes','SELECT')
     or has_table_privilege('service_role','public.hq_workforce_execution_envelopes','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_execution_envelopes','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_execution_envelopes','DELETE') then
    raise exception 'execution_envelope_direct_access_too_broad';
  end if;
  if not has_table_privilege('service_role','public.hq_workforce_execution_envelopes','SELECT') then
    raise exception 'execution_envelope_service_read_missing';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_get_execution_dossier(uuid)'::regprocedure)) into d;
  if position('hq_assert_owner' in d)=0 or position('execution_dossier_authenticated_owner_required' in d)=0 then
    raise exception 'execution_dossier_not_owner_bound';
  end if;
  if position('completeness' in d)=0 or position('breaker_events' in d)=0 or position('verifications' in d)=0
     or position('compensations' in d)=0 or position('outcomes' in d)=0 or position('escalations' in d)=0 then
    raise exception 'execution_dossier_missing_required_lifecycle_evidence';
  end if;
  if has_function_privilege('service_role','public.hq_workforce_get_execution_dossier(uuid)','EXECUTE') then
    raise exception 'service_role_can_read_owner_execution_dossier';
  end if;
end $$;

-- The trigger must be AFTER so the task FK exists when the envelope is inserted.
do $$
declare def text;
begin
  select lower(pg_get_triggerdef(tg.oid)) into def
  from pg_trigger tg
  join pg_class c on c.oid=tg.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='hq_workforce_task_contracts'
    and tg.tgname='trg_hq_workforce_ensure_execution_envelope' and not tg.tgisinternal;
  if def is null then raise exception 'execution_envelope_trigger_missing'; end if;
  if position(' after ' in def)=0 then raise exception 'execution_envelope_trigger_not_after'; end if;
end $$;

-- Every currently running task must have exactly one immutable execution identity.
do $$
declare missing_count integer; duplicate_count integer;
begin
  select count(*) into missing_count
  from public.hq_workforce_task_contracts t
  where t.status='running'
    and not exists(select 1 from public.hq_workforce_execution_envelopes e where e.task_id=t.id);
  if missing_count<>0 then raise exception 'running_task_without_execution_envelope:%',missing_count; end if;

  select count(*) into duplicate_count from (
    select task_id from public.hq_workforce_execution_envelopes group by task_id having count(*)<>1
  ) q;
  if duplicate_count<>0 then raise exception 'execution_envelope_not_unique_per_task'; end if;
end $$;

rollback;
