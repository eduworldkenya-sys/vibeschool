\set ON_ERROR_STOP on

begin;

-- Every new graph table is RLS-protected and raw graph intelligence is never
-- exposed through browser table grants.
do $$
declare
  v_table text;
  v_role text;
  v_rls boolean;
begin
  foreach v_table in array array[
    'curriculum_concepts','curriculum_concept_aliases','curriculum_outcome_concepts',
    'curriculum_concept_relations','curriculum_misconceptions','curriculum_misconception_outcomes',
    'learning_product_concept_links','learning_product_misconception_links'
  ] loop
    select c.relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=v_table and c.relkind='r';
    if v_rls is distinct from true then
      raise exception 'knowledge graph contract: % missing or RLS disabled',v_table;
    end if;

    foreach v_role in array array['anon','authenticated'] loop
      if has_table_privilege(v_role,format('public.%I',v_table),'SELECT')
         or has_table_privilege(v_role,format('public.%I',v_table),'INSERT')
         or has_table_privilege(v_role,format('public.%I',v_table),'UPDATE')
         or has_table_privilege(v_role,format('public.%I',v_table),'DELETE') then
        raise exception 'knowledge graph contract: % has direct privilege on %',v_role,v_table;
      end if;
    end loop;

    if not has_table_privilege('service_role',format('public.%I',v_table),'SELECT')
       or not has_table_privilege('service_role',format('public.%I',v_table),'INSERT')
       or not has_table_privilege('service_role',format('public.%I',v_table),'UPDATE')
       or not has_table_privilege('service_role',format('public.%I',v_table),'DELETE') then
      raise exception 'knowledge graph contract: service_role missing authority on %',v_table;
    end if;
  end loop;
end $$;

-- Public concept discovery is allowlisted; rich misconception/correction context
-- and learner-specific recommendations require authentication.
do $$
declare
  v_signature text;
  v_oid regprocedure;
  v_config text;
begin
  foreach v_signature in array array[
    'public.curriculum_search_concepts(text,uuid,integer)',
    'public.curriculum_get_outcome_semantic_context(uuid)',
    'public.student_get_learning_product_recommendations(integer)',
    'public.curriculum_normalize_semantic_term(text)',
    'public.curriculum_validate_concept_subject()',
    'public.curriculum_validate_outcome_concept_subject()',
    'public.curriculum_validate_misconception_outcome_subject()',
    'public.curriculum_prevent_concept_prerequisite_cycle()',
    'public.curriculum_prevent_outcome_prerequisite_cycle()'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then raise exception 'knowledge graph contract: missing function %',v_signature; end if;
    select coalesce(array_to_string(p.proconfig,','),'') into v_config from pg_proc p where p.oid=v_oid;
    if v_config not like '%search_path=%' then
      raise exception 'knowledge graph contract: % missing fixed search_path',v_signature;
    end if;
  end loop;

  if not has_function_privilege('anon','public.curriculum_search_concepts(text,uuid,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.curriculum_search_concepts(text,uuid,integer)','EXECUTE') then
    raise exception 'knowledge graph contract: concept search projection unavailable';
  end if;
  if has_function_privilege('anon','public.curriculum_get_outcome_semantic_context(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.curriculum_get_outcome_semantic_context(uuid)','EXECUTE') then
    raise exception 'knowledge graph contract: rich semantic context boundary incorrect';
  end if;
  if has_function_privilege('anon','public.student_get_learning_product_recommendations(integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.student_get_learning_product_recommendations(integer)','EXECUTE') then
    raise exception 'knowledge graph contract: learner recommendation execution boundary incorrect';
  end if;
  if has_function_privilege('authenticated','public.curriculum_normalize_semantic_term(text)','EXECUTE') then
    raise exception 'knowledge graph contract: internal normalization helper exposed';
  end if;
end $$;

-- Build rollback-only canonical fixtures so this verifier is independent of
-- seed files and production data population.
create temporary table kg_verify_fixture(
  canonical_subject_id uuid not null,
  curriculum_id uuid not null,
  noncanonical_subject_id uuid not null
) on commit drop;

do $$
declare
  v_subject uuid;
  v_curriculum uuid;
  v_noncanonical uuid;
begin
  insert into public.subjects(name,school_id,global_subject_id)
  values('KG Verifier Canonical Subject',null,null)
  returning id into v_subject;

  insert into public.curriculum(
    curriculum,grade,subject,term,week,strand,sub_strand,topic,global_subject_id
  ) values(
    'CBE','Verifier Grade','KG Verifier Canonical Subject',1,1,
    'Verifier Strand','Verifier Sub-strand','Verifier Topic',v_subject
  ) returning id into v_curriculum;

  insert into public.subjects(name,school_id,global_subject_id)
  values('KG Verifier Noncanonical Subject',null,null)
  returning id into v_noncanonical;

  insert into kg_verify_fixture(canonical_subject_id,curriculum_id,noncanonical_subject_id)
  values(v_subject,v_curriculum,v_noncanonical);
end $$;

-- Semantic knowledge may not become active without explicit provenance and
-- verification. No migration may manufacture semantic truth as a side effect.
do $$
declare
  v_subject uuid;
begin
  select canonical_subject_id into v_subject from kg_verify_fixture;

  begin
    insert into public.curriculum_concepts(
      subject_id,concept_key,title,status,authority_class
    ) values (
      v_subject,'verify.unproven-active','Unproven active concept','active','editorial_derived'
    );
    raise exception 'knowledge graph contract: unverified active concept accepted';
  exception when check_violation then null;
  end;

  if exists(select 1 from public.curriculum_concepts where status='active') then
    raise exception 'knowledge graph contract: migration seeded active concepts';
  end if;
  if exists(select 1 from public.curriculum_misconceptions where status='active') then
    raise exception 'knowledge graph contract: migration seeded active misconceptions';
  end if;
end $$;

-- A global subject that is not part of canonical curriculum cannot become a
-- curriculum concept. This also covers the stronger school-local exclusion.
do $$
declare
  v_noncanonical uuid;
begin
  select noncanonical_subject_id into v_noncanonical from kg_verify_fixture;
  begin
    insert into public.curriculum_concepts(subject_id,concept_key,title)
    values(v_noncanonical,'verify.noncanonical','Invalid noncanonical concept');
    raise exception 'knowledge graph contract: noncanonical subject accepted';
  exception when others then
    if sqlerrm = 'knowledge graph contract: noncanonical subject accepted' then raise; end if;
    if sqlerrm <> 'concept_requires_canonical_curriculum_subject' then raise; end if;
  end;
end $$;

-- Concept prerequisite cycles are rejected dynamically.
do $$
declare
  v_subject uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
begin
  select canonical_subject_id into v_subject from kg_verify_fixture;

  insert into public.curriculum_concepts(subject_id,concept_key,title)
    values(v_subject,'verify.cycle-a','Cycle A') returning id into v_a;
  insert into public.curriculum_concepts(subject_id,concept_key,title)
    values(v_subject,'verify.cycle-b','Cycle B') returning id into v_b;
  insert into public.curriculum_concepts(subject_id,concept_key,title)
    values(v_subject,'verify.cycle-c','Cycle C') returning id into v_c;

  insert into public.curriculum_concept_relations(from_concept_id,to_concept_id,relation_type)
    values(v_a,v_b,'prerequisite');
  insert into public.curriculum_concept_relations(from_concept_id,to_concept_id,relation_type)
    values(v_b,v_c,'prerequisite');

  begin
    insert into public.curriculum_concept_relations(from_concept_id,to_concept_id,relation_type)
      values(v_c,v_a,'prerequisite');
    raise exception 'knowledge graph contract: concept prerequisite cycle accepted';
  exception when others then
    if sqlerrm = 'knowledge graph contract: concept prerequisite cycle accepted' then raise; end if;
    if sqlerrm <> 'concept_prerequisite_cycle' then raise; end if;
  end;
end $$;

-- The pre-existing outcome prerequisite table is hardened rather than forked.
do $$
declare
  v_curriculum uuid;
  v_o1 uuid;
  v_o2 uuid;
  v_o3 uuid;
begin
  select curriculum_id into v_curriculum from kg_verify_fixture;

  insert into public.curriculum_learning_outcomes(curriculum_id,outcome_text,outcome_code,status)
    values(v_curriculum,'Verifier outcome A','VERIFY-CYCLE-A','draft') returning id into v_o1;
  insert into public.curriculum_learning_outcomes(curriculum_id,outcome_text,outcome_code,status)
    values(v_curriculum,'Verifier outcome B','VERIFY-CYCLE-B','draft') returning id into v_o2;
  insert into public.curriculum_learning_outcomes(curriculum_id,outcome_text,outcome_code,status)
    values(v_curriculum,'Verifier outcome C','VERIFY-CYCLE-C','draft') returning id into v_o3;

  insert into public.curriculum_outcome_prerequisites(outcome_id,prerequisite_outcome_id)
    values(v_o1,v_o2);
  insert into public.curriculum_outcome_prerequisites(outcome_id,prerequisite_outcome_id)
    values(v_o2,v_o3);

  begin
    insert into public.curriculum_outcome_prerequisites(outcome_id,prerequisite_outcome_id)
      values(v_o3,v_o1);
    raise exception 'knowledge graph contract: outcome prerequisite cycle accepted';
  exception when others then
    if sqlerrm = 'knowledge graph contract: outcome prerequisite cycle accepted' then raise; end if;
    if sqlerrm <> 'outcome_prerequisite_cycle' then raise; end if;
  end;
end $$;

-- Recommendation is deterministically evidence-gated and commerce-gated.
do $$
declare
  v_fn text;
  v_search text;
  v_context text;
begin
  select pg_get_functiondef('public.student_get_learning_product_recommendations(integer)'::regprocedure) into v_fn;
  if v_fn not like '%mastery_score < 70%'
     or v_fn not like '%evidence_count > 0%'
     or v_fn not like '%rights_status = ''cleared''%'
     or v_fn not like '%pricing_model = ''one_time''%'
     or v_fn not like '%recorded_outcome_weakness%'
     or v_fn not like '%ambiguous_learner_identity%' then
    raise exception 'knowledge graph contract: recommendation is not fully evidence/identity/commerce gated';
  end if;

  select pg_get_functiondef('public.curriculum_search_concepts(text,uuid,integer)'::regprocedure) into v_search;
  if v_search not like '%status = ''active''%'
     or v_search not like '%verified_at is not null%' then
    raise exception 'knowledge graph contract: search can surface unverified semantic claims';
  end if;

  select pg_get_functiondef('public.curriculum_get_outcome_semantic_context(uuid)'::regprocedure) into v_context;
  if v_context not like '%o.status = ''active''%'
     or v_context not like '%cc.status = ''active''%'
     or v_context not like '%m.status = ''active''%' then
    raise exception 'knowledge graph contract: context can surface draft semantic claims';
  end if;
end $$;

-- The P0 graph is deliberately additive: no automatic concept/misconception or
-- product-semantic mappings are invented by installation.
do $$
begin
  if exists(select 1 from public.learning_product_concept_links) then
    raise exception 'knowledge graph contract: migration invented product-concept mappings';
  end if;
  if exists(select 1 from public.learning_product_misconception_links) then
    raise exception 'knowledge graph contract: migration invented product-misconception mappings';
  end if;
end $$;

rollback;

\echo 'Content Knowledge Graph Contract: PASS'
