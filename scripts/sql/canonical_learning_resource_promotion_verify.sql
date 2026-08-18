-- Canonical Learning Assets R3.4/R3.6 promotion and economic authority contract.
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_def text;
  v_rls boolean;
begin
  if to_regclass('public.learning_resource_versions') is null then
    raise exception 'canonical version table missing';
  end if;

  select relrowsecurity into v_rls
  from pg_class
  where oid='public.learning_resource_versions'::regclass;
  if not coalesce(v_rls,false) then
    raise exception 'canonical versions RLS disabled';
  end if;

  if has_table_privilege('service_role','public.learning_resource_versions','UPDATE') then
    raise exception 'service_role retains direct canonical version UPDATE';
  end if;

  if not has_table_privilege('service_role','public.learning_resource_versions','INSERT')
     or not has_table_privilege('service_role','public.learning_resource_versions','SELECT')
     or has_table_privilege('service_role','public.learning_resource_versions','DELETE') then
    raise exception 'service-role candidate table boundary incorrect';
  end if;

  if has_function_privilege('anon','public.cla_verify_learning_resource_candidate(uuid,text,jsonb,text)','EXECUTE')
     or has_function_privilege('authenticated','public.cla_verify_learning_resource_candidate(uuid,text,jsonb,text)','EXECUTE')
     or not has_function_privilege('service_role','public.cla_verify_learning_resource_candidate(uuid,text,jsonb,text)','EXECUTE') then
    raise exception 'verification execute boundary incorrect';
  end if;

  if has_function_privilege('anon','public.cla_reject_learning_resource_candidate(uuid,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.cla_reject_learning_resource_candidate(uuid,jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.cla_reject_learning_resource_candidate(uuid,jsonb)','EXECUTE') then
    raise exception 'rejection execute boundary incorrect';
  end if;

  if has_function_privilege('anon','public.cla_certify_learning_resource_version(uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.cla_certify_learning_resource_version(uuid,text,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.cla_certify_learning_resource_version(uuid,text,jsonb)','EXECUTE') then
    raise exception 'certification execute boundary incorrect';
  end if;

  if has_function_privilege('anon','public.cla_retire_learning_resource_version(uuid,jsonb)','EXECUTE')
     or has_function_privilege('service_role','public.cla_retire_learning_resource_version(uuid,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.cla_retire_learning_resource_version(uuid,jsonb)','EXECUTE') then
    raise exception 'retirement execute boundary incorrect';
  end if;

  if has_function_privilege('anon','public.cla_reserve_learning_resource_credit(uuid,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.cla_reserve_learning_resource_credit(uuid,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.cla_reserve_learning_resource_credit(uuid,integer)','EXECUTE') then
    raise exception 'credit reservation execute boundary incorrect';
  end if;

  if has_function_privilege('anon','public.cla_refund_learning_resource_credit(uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.cla_refund_learning_resource_credit(uuid,text)','EXECUTE')
     or not has_function_privilege('service_role','public.cla_refund_learning_resource_credit(uuid,text)','EXECUTE') then
    raise exception 'credit refund execute boundary incorrect';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='learning_resource_generation_claims'
      and column_name='credit_reserved'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='learning_resource_generation_claims'
      and column_name='credit_refunded_at'
  ) then
    raise exception 'claim-bound credit reservation columns missing';
  end if;

  select pg_get_functiondef('public.cla_reserve_learning_resource_credit(uuid,integer)'::regprocedure)
  into v_def;
  if v_def not ilike '%for update%'
     or v_def not ilike '%vibe_credits%'
     or v_def not ilike '%credit_reserved%'
     or v_def not ilike '%balance < p_amount%'
     or v_def not ilike '%total_spent = total_spent + p_amount%' then
    raise exception 'credit reservation does not atomically lock claim/wallet and spend';
  end if;

  select pg_get_functiondef('public.cla_refund_learning_resource_credit(uuid,text)'::regprocedure)
  into v_def;
  if v_def not ilike '%credit_refunded_at is not null%'
     or v_def not ilike '%status = ''completed''%'
     or v_def not ilike '%total_spent = greatest(0, total_spent - v_claim.credit_reserved)%'
     or v_def not ilike '%credit_refunded_at = now()%' then
    raise exception 'credit refund is not idempotent or completion-safe';
  end if;

  select pg_get_functiondef('public.cla_verify_learning_resource_candidate(uuid,text,jsonb,text)'::regprocedure)
  into v_def;
  if v_def not ilike '%lifecycle_status <> ''candidate''%'
     or v_def not ilike '%CLA_RIGHTS_CLEARANCE_REQUIRED%'
     or v_def not ilike '%verification_evidence%'
     or v_def not ilike '%lifecycle_status = ''verified''%' then
    raise exception 'verification gate does not fail closed';
  end if;

  select pg_get_functiondef('public.cla_certify_learning_resource_version(uuid,text,jsonb)'::regprocedure)
  into v_def;
  if v_def not ilike '%is_platform_owner()%'
     or v_def not ilike '%lifecycle_status <> ''verified''%'
     or v_def not ilike '%CLA_INDEPENDENT_VERIFICATION_REQUIRED%'
     or v_def not ilike '%CLA_RIGHTS_CLEARANCE_REQUIRED%'
     or v_def not ilike '%lifecycle_status = ''certified''%' then
    raise exception 'certification gate does not require owner + verification + rights';
  end if;

  select pg_get_functiondef('public.cla_guard_resource_version_mutation()'::regprocedure)
  into v_def;
  if v_def not ilike '%verification_policy_version%'
     or v_def not ilike '%verification_evidence%'
     or v_def not ilike '%CLA_CERTIFIED_VERSION_IMMUTABLE%'
     or v_def not ilike '%CLA_RETIRED_VERSION_IMMUTABLE%' then
    raise exception 'immutability guard does not cover verification evidence';
  end if;
end $$;

-- Prove a candidate can only reach verified through the explicit verification
-- function and that an unauthenticated caller cannot self-certify it.
do $$
declare
  v_root uuid;
  v_version uuid;
  v_status text;
  v_failed boolean := false;
begin
  insert into public.learning_resources(
    source_type,title,status,visibility,owner_type,canonical_key,
    asset_kind,purpose,identity_key_version,language_code
  ) values (
    'platform_generated','CLA promotion test','active','public','platform',
    'cla:test:r3.4:promotion','lesson_plan','teach',1,'en'
  ) returning id into v_root;

  insert into public.learning_resource_versions(
    resource_id,version,lifecycle_status,payload,content_sha256,provenance
  ) values (
    v_root,1,'candidate','{"plan":{"objectives":"test"}}'::jsonb,
    repeat('f',64),'{"origin":"test"}'::jsonb
  ) returning id into v_version;

  perform public.cla_verify_learning_resource_candidate(
    v_version,
    'test-verifier-v1',
    '{"semantic":"supported","quality":"passed","source_count":2}'::jsonb,
    'not_applicable'
  );

  select lifecycle_status into v_status
  from public.learning_resource_versions
  where id=v_version;
  if v_status <> 'verified' then
    raise exception 'candidate did not become verified';
  end if;

  begin
    perform public.cla_certify_learning_resource_version(
      v_version,
      'test-certifier-v1',
      '{"review":"passed"}'::jsonb
    );
  exception when insufficient_privilege then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'unauthenticated session self-certified canonical version';
  end if;

  if (select lifecycle_status from public.learning_resource_versions where id=v_version) <> 'verified' then
    raise exception 'failed certification mutated verified candidate';
  end if;
end $$;

rollback;
