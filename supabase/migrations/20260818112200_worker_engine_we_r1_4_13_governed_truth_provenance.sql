-- WE-R1.4.13: governed truth provenance.
-- NON-ACTIVATING. service_role may record observations, but it may not manufacture
-- verified/authoritative institutional memory or human/founder approval truth.

-- Retire direct externally callable legacy truth/promotion front doors.
-- Production and clean rebuilds do not necessarily contain the same historical overloads,
-- so revoke discovered functions by OID/name instead of assuming a signature exists.
do $$
declare r record;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('hq_workforce_capture_founder_decision','hq_workforce_certify_learning_pipeline')
  loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',r.oid::regprocedure);
  end loop;
end $$;

-- Preserve the X2 memory constructor as an internal implementation, then expose the
-- same public RPC name with a stricter contract: transport can only create non-authoritative
-- memory. Verified authority must be conferred by an identity-bound review function.
alter function public.hq_workforce_add_memory(
  text,text,jsonb,jsonb,text,text,numeric,text,boolean,text,jsonb,text[],text[],
  timestamptz,timestamptz,timestamptz,uuid,text,timestamptz
) rename to hq_workforce_add_memory_r13x_untrusted_internal;

create or replace function public.hq_workforce_add_memory(
  p_memory_key text,
  p_memory_type text,
  p_content jsonb,
  p_provenance jsonb,
  p_source_kind text,
  p_source_ref text,
  p_confidence numeric,
  p_verification_state text default 'unverified',
  p_authoritative boolean default false,
  p_scope_type text default 'platform_internal',
  p_scope_ref jsonb default '{}'::jsonb,
  p_data_classifications text[] default array['internal']::text[],
  p_jurisdictions text[] default array['global']::text[],
  p_valid_from timestamptz default clock_timestamp(),
  p_valid_until timestamptz default null,
  p_observed_at timestamptz default null,
  p_supersedes_id uuid default null,
  p_contradiction_group text default null,
  p_retention_until timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(p_authoritative,false) then
    raise exception 'service_transport_cannot_create_authoritative_memory';
  end if;
  if coalesce(p_verification_state,'unverified')='verified' then
    raise exception 'verified_memory_requires_identity_bound_review';
  end if;
  if coalesce(p_verification_state,'unverified') not in ('unverified','corroborated','disputed') then
    raise exception 'memory_initial_verification_state_not_allowed:%',p_verification_state;
  end if;
  return public.hq_workforce_add_memory_r13x_untrusted_internal(
    p_memory_key,p_memory_type,p_content,p_provenance,p_source_kind,p_source_ref,p_confidence,
    coalesce(p_verification_state,'unverified'),false,p_scope_type,p_scope_ref,
    p_data_classifications,p_jurisdictions,p_valid_from,p_valid_until,p_observed_at,
    p_supersedes_id,p_contradiction_group,p_retention_until
  );
end $$;

create or replace function public.hq_workforce_owner_verify_memory(
  p_memory_id uuid,
  p_reason text,
  p_evidence_refs jsonb,
  p_authoritative boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  m public.hq_workforce_memory_records%rowtype;
  v_uid uuid;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'memory_review_requires_authenticated_owner'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 4000 then raise exception 'memory_review_reason_required'; end if;
  if coalesce(jsonb_typeof(p_evidence_refs),'null')<>'array' or jsonb_array_length(p_evidence_refs)=0 then
    raise exception 'memory_review_evidence_required';
  end if;

  select * into m from public.hq_workforce_memory_records where id=p_memory_id for update;
  if not found then raise exception 'memory_not_found'; end if;
  if m.verification_state in ('superseded','revoked') then raise exception 'memory_not_reviewable:%',m.verification_state; end if;
  if m.valid_until is not null and m.valid_until<=clock_timestamp() then raise exception 'memory_expired'; end if;
  if m.memory_type='hypothesis' and coalesce(p_authoritative,false) then raise exception 'hypothesis_cannot_be_authoritative'; end if;

  update public.hq_workforce_memory_records
     set verification_state='verified',authoritative=coalesce(p_authoritative,false)
   where id=m.id;
  insert into public.hq_workforce_memory_events(memory_id,event_kind,actor_type,actor_ref,reason,evidence_refs,payload)
  values(m.id,'verified','human',v_uid::text,btrim(p_reason),p_evidence_refs,
         jsonb_build_object('authoritative',coalesce(p_authoritative,false),'previous_state',m.verification_state));

  return jsonb_build_object('memory_id',m.id,'verification_state','verified','authoritative',coalesce(p_authoritative,false),'verified_by',v_uid);
end $$;

-- Direct service-role writes would bypass the constructor/review split. Keep read access,
-- but route writes through SECURITY DEFINER governed functions.
revoke insert,update,delete on table public.hq_workforce_memory_records from service_role;
revoke insert,update,delete on table public.hq_workforce_memory_events from service_role;
revoke insert,update,delete on table public.hq_workforce_objective_context from service_role;

revoke all on function public.hq_workforce_add_memory_r13x_untrusted_internal(
  text,text,jsonb,jsonb,text,text,numeric,text,boolean,text,jsonb,text[],text[],
  timestamptz,timestamptz,timestamptz,uuid,text,timestamptz
) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_add_memory(
  text,text,jsonb,jsonb,text,text,numeric,text,boolean,text,jsonb,text[],text[],
  timestamptz,timestamptz,timestamptz,uuid,text,timestamptz
) from public,anon,authenticated;
grant execute on function public.hq_workforce_add_memory(
  text,text,jsonb,jsonb,text,text,numeric,text,boolean,text,jsonb,text[],text[],
  timestamptz,timestamptz,timestamptz,uuid,text,timestamptz
) to service_role;
revoke all on function public.hq_workforce_owner_verify_memory(uuid,text,jsonb,boolean) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_verify_memory(uuid,text,jsonb,boolean) to authenticated;

-- NON-ACTIVATION + truth-boundary attestation.
do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  r record;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.13 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.13 violated fail_closed_activation_boundary';
  end if;
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('hq_workforce_capture_founder_decision','hq_workforce_certify_learning_pipeline')
  loop
    if has_function_privilege('service_role',r.oid,'EXECUTE') then
      raise exception 'WE-R1.4.13 legacy truth gateway remains service callable:%',r.oid::regprocedure;
    end if;
  end loop;
  if has_table_privilege('service_role','public.hq_workforce_memory_records','UPDATE') then
    raise exception 'WE-R1.4.13 direct memory truth write remains';
  end if;
end $$;
