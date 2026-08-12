-- Preserve negative verification evidence and require fresh remediation evidence.

create or replace function public.hq_workforce_record_shadow_run(p_worker_key text,p_tool_contract_id uuid,p_input jsonb,p_expected jsonb,p_observed jsonb,p_verifier_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_pass boolean; v_state text;
begin
 v_state:=public.hq_workforce_current_lifecycle_state(p_worker_key);
 if v_state not in ('shadow','remediation') then raise exception 'worker_not_in_shadow_or_remediation'; end if;
 if coalesce(trim(p_verifier_key),'')='' or p_verifier_key=p_worker_key then raise exception 'independent_verifier_required'; end if;
 perform 1 from public.hq_workforce_tool_contracts where id=p_tool_contract_id and status='approved'; if not found then raise exception 'approved_tool_required'; end if;
 v_pass:=p_expected=p_observed;
 insert into public.hq_workforce_shadow_runs(worker_key,tool_contract_id,input_snapshot,expected_outcome,observed_outcome,verifier_key,passed)
 values(p_worker_key,p_tool_contract_id,p_input,p_expected,p_observed,p_verifier_key,v_pass) returning id into v_id;
 return v_id;
end $$;

create or replace function public.hq_workforce_issue_certification(p_worker_key text,p_creation_contract_id uuid,p_verifier_key text,p_required integer default 3,p_valid_for interval default interval '30 days')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_passed int; v_id uuid; v_since timestamptz;
begin
 if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'certification_pending' then raise exception 'worker_not_certification_pending'; end if;
 if p_verifier_key=p_worker_key or coalesce(trim(p_verifier_key),'')='' then raise exception 'independent_verifier_required'; end if;
 if p_required<3 then raise exception 'minimum_three_shadow_runs'; end if;
 if p_valid_for<=interval '0 seconds' then raise exception 'certification_validity_required'; end if;
 select coalesce(max(issued_at),'-infinity'::timestamptz) into v_since from public.hq_workforce_certifications where worker_key=p_worker_key;
 select count(*) into v_passed from public.hq_workforce_shadow_runs where worker_key=p_worker_key and passed and verifier_key=p_verifier_key and executed_at>v_since;
 if v_passed<p_required then raise exception 'insufficient_fresh_verified_shadow_runs'; end if;
 insert into public.hq_workforce_certifications(worker_key,creation_contract_id,certification_key,status,required_shadow_runs,passed_shadow_runs,verifier_key,expires_at)
 values(p_worker_key,p_creation_contract_id,p_worker_key||':'||extract(epoch from clock_timestamp())::bigint,'active',p_required,v_passed,p_verifier_key,now()+p_valid_for) returning id into v_id;
 return v_id;
end $$;

create or replace function public.hq_workforce_guard_certification_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then raise exception 'worker_certification_delete_forbidden'; end if;
 if (new.worker_key,new.creation_contract_id,new.certification_key,new.required_shadow_runs,new.passed_shadow_runs,new.verifier_key,new.issued_at,new.expires_at)
    is distinct from
    (old.worker_key,old.creation_contract_id,old.certification_key,old.required_shadow_runs,old.passed_shadow_runs,old.verifier_key,old.issued_at,old.expires_at) then raise exception 'worker_certification_immutable'; end if;
 if old.status<>new.status and not (old.status='active' and new.status in ('revoked','expired')) then raise exception 'illegal_certification_status_transition'; end if;
 return new;
end $$;
drop trigger if exists trg_hq_workforce_guard_certification_mutation on public.hq_workforce_certifications;
create trigger trg_hq_workforce_guard_certification_mutation before update or delete on public.hq_workforce_certifications for each row execute function public.hq_workforce_guard_certification_mutation();

create or replace function public.hq_workforce_verify_task(p_task_id uuid,p_verifier_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.hq_workforce_task_contracts%rowtype; wi public.hq_work_items%rowtype; v_id uuid; v_expected jsonb; v_observed jsonb; v_pass boolean;
begin
 if coalesce(trim(p_verifier_key),'')='' then raise exception 'independent_verifier_required'; end if;
 select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
 if not found then raise exception 'task_not_found'; end if;
 if p_verifier_key=t.worker_key then raise exception 'worker_cannot_verify_own_task'; end if;
 if t.status<>'completed' then raise exception 'task_not_completed'; end if;
 if t.verification_status<>'pending' then raise exception 'task_already_verified'; end if;
 if t.resource_type<>'hq_work_items' or t.operation<>'update' then raise exception 'unsupported_task_verification_contract'; end if;
 select * into wi from public.hq_work_items where id=nullif(t.payload->>'work_item_id','')::uuid;
 if not found then raise exception 'verification_resource_not_found'; end if;
 v_expected:=jsonb_build_object('worker_key',t.worker_key,'action','triage_and_own','task_id',t.id::text);
 v_observed:=jsonb_build_object('worker_key',wi.action_taken->>'worker_key','action',wi.action_taken->>'action','task_id',wi.action_taken->>'task_id');
 v_pass:=v_expected=v_observed;
 insert into public.hq_workforce_task_verifications(task_id,verifier_key,expected_outcome,observed_outcome,passed)
 values(t.id,p_verifier_key,v_expected,v_observed,v_pass) returning id into v_id;
 update public.hq_workforce_task_contracts set verification_status=case when v_pass then 'verified' else 'failed' end where id=t.id;
 update public.hq_work_items set verification_status=case when v_pass then 'verified' else 'failed' end,
   verification_evidence=jsonb_build_object('task_id',t.id,'verifier_key',p_verifier_key,'expected',v_expected,'observed',v_observed),
   status=case when v_pass then 'resolved' else status end,
   resolved_at=case when v_pass then coalesce(resolved_at,now()) else resolved_at end
 where id=wi.id;
 return v_id;
end $$;

create or replace function public.hq_workforce_autonomous_heartbeat(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_key text; v_detected int:=0; v_processed int:=0; v_verified int:=0; v_failed int:=0; r record; v_ver uuid; v_pass boolean; v_result jsonb;
begin
 if p_limit<1 or p_limit>100 then raise exception 'invalid_heartbeat_limit'; end if;
 v_key:='heartbeat:'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'); insert into public.hq_workforce_heartbeat_runs(heartbeat_key) values(v_key);
 begin v_detected:=public.hq_workforce_detect_reference_operations_tasks('operations_reference_v1',p_limit); exception when others then v_detected:=0; end;
 v_processed:=public.hq_workforce_execute_task_queue(p_limit,60);
 for r in select id from public.hq_workforce_task_contracts where worker_key='operations_reference_v1' and status='completed' and verification_status='pending' order by completed_at limit p_limit loop
   begin
     v_ver:=public.hq_workforce_verify_task(r.id,'deterministic_reference_verifier_v1');
     select passed into v_pass from public.hq_workforce_task_verifications where id=v_ver;
     if v_pass then v_verified:=v_verified+1; else v_failed:=v_failed+1; end if;
   exception when others then v_failed:=v_failed+1; end;
 end loop;
 v_result:=jsonb_build_object('heartbeat_key',v_key,'detected',v_detected,'processed',v_processed,'verified',v_verified,'failed_verifications',v_failed,'mode','deterministic');
 update public.hq_workforce_heartbeat_runs set completed_at=now(),tasks_processed=v_processed,tasks_failed=v_failed,result=v_result where heartbeat_key=v_key;
 return v_result;
end $$;

revoke all on function public.hq_workforce_guard_certification_mutation() from public,anon,authenticated;
grant execute on function public.hq_workforce_guard_certification_mutation() to service_role;
