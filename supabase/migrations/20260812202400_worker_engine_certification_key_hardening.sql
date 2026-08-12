create or replace function public.hq_workforce_issue_certification(p_worker_key text,p_creation_contract_id uuid,p_verifier_key text,p_required integer default 3,p_valid_for interval default interval '30 days')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_passed int; v_id uuid; v_since timestamptz; v_issued timestamptz;
begin
 if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'certification_pending' then raise exception 'worker_not_certification_pending'; end if;
 if p_verifier_key=p_worker_key or coalesce(trim(p_verifier_key),'')='' then raise exception 'independent_verifier_required'; end if;
 if p_required<3 then raise exception 'minimum_three_shadow_runs'; end if;
 if p_valid_for<=interval '0 seconds' then raise exception 'certification_validity_required'; end if;
 select coalesce(max(issued_at),'-infinity'::timestamptz) into v_since from public.hq_workforce_certifications where worker_key=p_worker_key;
 select count(*) into v_passed from public.hq_workforce_shadow_runs where worker_key=p_worker_key and passed and verifier_key=p_verifier_key and executed_at>v_since;
 if v_passed<p_required then raise exception 'insufficient_fresh_verified_shadow_runs'; end if;
 v_issued:=clock_timestamp();
 insert into public.hq_workforce_certifications(worker_key,creation_contract_id,certification_key,status,required_shadow_runs,passed_shadow_runs,verifier_key,issued_at,expires_at)
 values(p_worker_key,p_creation_contract_id,p_worker_key||':'||gen_random_uuid()::text,'active',p_required,v_passed,p_verifier_key,v_issued,v_issued+p_valid_for) returning id into v_id;
 return v_id;
end $$;
