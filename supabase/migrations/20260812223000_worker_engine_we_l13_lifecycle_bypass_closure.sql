-- WE-L13: close alternate worker creation/certification/lifecycle entrypoints.
-- The scheduled governed control loop is the service-role authority path.

create or replace function public.hq_workforce_transition_worker(p_worker_key text,p_to_state text,p_reason text,p_creation_contract_id uuid default null)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_from text; v_allowed boolean:=false; v_contract public.hq_workforce_creation_contracts%rowtype;
begin
 if coalesce(trim(p_reason),'')='' then raise exception 'transition_reason_required'; end if;
 perform 1 from public.hq_workforce_workers where worker_key=p_worker_key for update; if not found then raise exception 'worker_not_found'; end if;
 v_from:=public.hq_workforce_current_lifecycle_state(p_worker_key);
 v_allowed:=case
   when v_from='proposed' and p_to_state='requested' then true
   when v_from='requested' and p_to_state='instantiated' then true
   when v_from='instantiated' and p_to_state='provisioned' then true
   when v_from='provisioned' and p_to_state='shadow' then true
   when v_from='shadow' and p_to_state='certification_pending' then true
   when v_from='certification_pending' and p_to_state='certified' then true
   when v_from='certified' and p_to_state='active' then true
   when v_from='active' and p_to_state='suspended' then true
   when v_from='suspended' and p_to_state in ('remediation','retired') then true
   when v_from='remediation' and p_to_state='certification_pending' then true
   when v_from='active' and p_to_state='retired' then true
   when v_from='retired' and p_to_state='archived' then true else false end;
 if not v_allowed then raise exception 'illegal_worker_lifecycle_transition:%->%',v_from,p_to_state; end if;
 if p_to_state in ('instantiated','provisioned','shadow','certification_pending','certified','active') then
   if p_creation_contract_id is null then raise exception 'creation_contract_required'; end if;
   select * into v_contract from public.hq_workforce_creation_contracts where id=p_creation_contract_id and worker_key=p_worker_key and status in ('issued','consumed') and (expires_at is null or expires_at>clock_timestamp()) for update;
   if not found then raise exception 'valid_creation_contract_required'; end if;
 end if;
 if p_to_state in ('certified','active') then perform public.hq_workforce_assert_certification(p_worker_key); end if;
 insert into public.hq_workforce_lifecycle_events(worker_key,from_state,to_state,reason,creation_contract_id) values(p_worker_key,v_from,p_to_state,p_reason,p_creation_contract_id);
 return p_to_state;
end $$;

-- Legacy and low-level positive-authority mutators are no longer service-role entrypoints.
revoke all on function public.hq_workforce_transition_worker(text,text,text,uuid) from service_role;
revoke all on function public.hq_workforce_record_shadow_run(text,uuid,jsonb,jsonb,jsonb,text) from service_role;
revoke all on function public.hq_workforce_issue_certification(text,uuid,text,integer,interval) from service_role;
revoke all on function public.hq_workforce_bootstrap_reference_operations_worker(text) from service_role;
revoke all on function public.hq_workforce_certify_probation_workers() from service_role;

-- Negative-authority/emergency controls remain callable where previously granted:
-- revocation, suspension and remediation reduce authority and are not worker-creation bypasses.
