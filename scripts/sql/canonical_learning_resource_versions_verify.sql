-- Canonical Learning Assets R3.2 adversarial contract.
-- Run after the full migration chain in a disposable/local Supabase.
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_rls boolean;
  v_count integer;
  v_def text;
  v_root_a uuid;
  v_root_b uuid;
  v_v1 uuid;
  v_v2 uuid;
  v_b1 uuid;
  v_failed boolean;
begin
  if to_regclass('public.learning_resource_versions') is null then raise exception 'canonical version table missing'; end if;

  select relrowsecurity into v_rls from pg_class where oid = 'public.learning_resource_versions'::regclass;
  if not coalesce(v_rls, false) then raise exception 'canonical version RLS disabled'; end if;

  if has_table_privilege('anon','public.learning_resource_versions','SELECT')
     or has_table_privilege('anon','public.learning_resource_versions','INSERT')
     or has_table_privilege('anon','public.learning_resource_versions','UPDATE')
     or has_table_privilege('anon','public.learning_resource_versions','DELETE') then
    raise exception 'anon has canonical version table privilege';
  end if;

  if not has_table_privilege('authenticated','public.learning_resource_versions','SELECT')
     or has_table_privilege('authenticated','public.learning_resource_versions','INSERT')
     or has_table_privilege('authenticated','public.learning_resource_versions','UPDATE')
     or has_table_privilege('authenticated','public.learning_resource_versions','DELETE') then
    raise exception 'authenticated canonical version privilege boundary incorrect';
  end if;

  -- Final R3.4 authority: service executors may read/deposit candidates, but
  -- lifecycle/evidence mutation must go through governed SECURITY DEFINER RPCs.
  -- Direct UPDATE/DELETE would let a service process bypass independent
  -- verification and platform-owner certification.
  if not has_table_privilege('service_role','public.learning_resource_versions','SELECT')
     or not has_table_privilege('service_role','public.learning_resource_versions','INSERT')
     or has_table_privilege('service_role','public.learning_resource_versions','UPDATE')
     or has_table_privilege('service_role','public.learning_resource_versions','DELETE') then
    raise exception 'service_role canonical version privilege boundary incorrect';
  end if;

  if has_function_privilege('anon','public.cla_get_certified_learning_resource(text)','EXECUTE')
     or not has_function_privilege('authenticated','public.cla_get_certified_learning_resource(text)','EXECUTE')
     or not has_function_privilege('service_role','public.cla_get_certified_learning_resource(text)','EXECUTE') then
    raise exception 'certified lookup execute boundary incorrect';
  end if;

  if has_function_privilege('anon','public.cla_guard_resource_version_mutation()','EXECUTE')
     or has_function_privilege('authenticated','public.cla_guard_resource_version_mutation()','EXECUTE')
     or has_function_privilege('anon','public.cla_validate_resource_version_lineage()','EXECUTE')
     or has_function_privilege('authenticated','public.cla_validate_resource_version_lineage()','EXECUTE')
     or has_function_privilege('anon','public.cla_validate_teaching_resource_version_pin()','EXECUTE')
     or has_function_privilege('authenticated','public.cla_validate_teaching_resource_version_pin()','EXECUTE') then
    raise exception 'internal CLA trigger function executable by browser role';
  end if;

  select count(*) into v_count from pg_indexes
  where schemaname='public' and tablename='learning_resource_versions'
    and indexname in ('learning_resource_versions_one_certified_uidx','learning_resource_versions_one_inflight_uidx');
  if v_count <> 2 then raise exception 'canonical version uniqueness indexes missing'; end if;

  select pg_get_functiondef('public.cla_get_certified_learning_resource(text)'::regprocedure) into v_def;
  if v_def not ilike '%lifecycle_status = ''certified''%'
     or v_def not ilike '%fn_learning_resource_visible%'
     or v_def not ilike '%status = ''active''%' then
    raise exception 'certified lookup does not fail closed to active certified visible resources';
  end if;

  insert into public.learning_resources(source_type,title,status,visibility,owner_type,canonical_key,asset_kind,purpose,identity_key_version,language_code)
  values ('platform_generated','CLA verification root A','active','public','platform','cla:test:r3.2:root-a','lesson_plan','teach',1,'en') returning id into v_root_a;

  insert into public.learning_resources(source_type,title,status,visibility,owner_type,canonical_key,asset_kind,purpose,identity_key_version,language_code)
  values ('platform_generated','CLA verification root B','active','public','platform','cla:test:r3.2:root-b','lesson_plan','teach',1,'en') returning id into v_root_b;

  insert into public.learning_resource_versions(resource_id,version,lifecycle_status,payload,content_sha256,provenance,rights_status,certification_policy_version,certification_evidence,verified_at,certified_at)
  values (v_root_a,1,'certified','{"body":"version one"}'::jsonb,repeat('a',64),'{"origin":"test"}'::jsonb,'cleared','test-policy-v1','{"semantic":"passed","rights":"passed"}'::jsonb,now(),now())
  returning id into v_v1;

  v_failed := false;
  begin
    insert into public.learning_resource_versions(resource_id,version,previous_version_id,lifecycle_status,payload,content_sha256,provenance,rights_status,certification_policy_version,certification_evidence,verified_at,certified_at)
    values (v_root_a,2,v_v1,'certified','{"body":"version two"}'::jsonb,repeat('b',64),'{"origin":"test"}'::jsonb,'cleared','test-policy-v1','{"semantic":"passed","rights":"passed"}'::jsonb,now(),now());
  exception when unique_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'two certified versions coexisted for one root'; end if;

  insert into public.learning_resource_versions(resource_id,version,lifecycle_status,payload,content_sha256)
  values (v_root_b,1,'candidate','{"body":"root b version one"}'::jsonb,repeat('c',64)) returning id into v_b1;

  v_failed := false;
  begin
    insert into public.learning_resource_versions(resource_id,version,previous_version_id,lifecycle_status,payload,content_sha256)
    values (v_root_a,2,v_b1,'candidate','{"body":"bad lineage"}'::jsonb,repeat('d',64));
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'cross-root version lineage was accepted'; end if;

  v_failed := false;
  begin
    update public.learning_resource_versions set payload='{"body":"tampered"}'::jsonb where id=v_v1;
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'certified version payload mutated'; end if;

  update public.learning_resource_versions set lifecycle_status='retired', retired_at=now() where id=v_v1;

  v_failed := false;
  begin
    update public.learning_resource_versions set payload='{"body":"tampered after retirement"}'::jsonb where id=v_v1;
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'retired version mutated'; end if;

  insert into public.learning_resource_versions(resource_id,version,previous_version_id,lifecycle_status,payload,content_sha256,provenance,rights_status,certification_policy_version,certification_evidence,verified_at,certified_at)
  values (v_root_a,2,v_v1,'certified','{"body":"version two"}'::jsonb,repeat('e',64),'{"origin":"test"}'::jsonb,'cleared','test-policy-v1','{"semantic":"passed","rights":"passed"}'::jsonb,now(),now())
  returning id into v_v2;

  if (select lifecycle_status from public.learning_resource_versions where id=v_v2) <> 'certified' then
    raise exception 'successor version not certified';
  end if;

  if exists (select 1 from public.cla_get_certified_learning_resource('cla:test:r3.2:root-b')) then
    raise exception 'candidate leaked through certified lookup';
  end if;

  if not exists (
    select 1 from public.cla_get_certified_learning_resource('cla:test:r3.2:root-a') x
    where x.resource_version_id=v_v2 and x.version=2
  ) then raise exception 'certified successor lookup failed'; end if;
end $$;
rollback;