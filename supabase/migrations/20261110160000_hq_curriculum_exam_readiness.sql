-- Owner-only readiness report. Never promotes, verifies, or modifies curricular data.
create or replace function public.hq_curriculum_exam_readiness(
  p_grade text, p_subject text
) returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $fn$
declare
  v_grade text:=nullif(btrim(coalesce(p_grade,'')),'');
  v_subject text:=nullif(btrim(coalesce(p_subject,'')),'');
  v_subject_id uuid;
  v_sources integer:=0; v_approved_sources integer:=0;
  v_snapshots integer:=0; v_promoted integer:=0; v_observations integer:=0;
  v_bindings integer:=0; v_sub_strands integer:=0;
  v_populated_strands integer:=0; v_sourced_strands integer:=0;
  v_outcomes integer:=0; v_verified integer:=0;
  v_blueprints integer:=0; v_bank_questions integer:=0;
  v_pilot_items integer:=0; v_pilot_verified_items integer:=0;
  v_issues jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'platform_owner_required' using errcode='42501';
  end if;
  if v_grade is null or length(v_grade)>40 or v_subject is null or length(v_subject)>120 then
    raise exception 'invalid_curriculum_scope';
  end if;
  select id into v_subject_id from public.subjects
  where school_id is null and lower(btrim(name))=lower(v_subject) order by id limit 1;
  if v_subject_id is null then raise exception 'canonical_subject_not_found'; end if;

  select count(*)::int,count(*) filter(where source_status='approved')::int
    into v_sources,v_approved_sources
  from public.curriculum_authority_sources
  where canonical_subject_id=v_subject_id and lower(btrim(grade))=lower(v_grade);

  select count(*)::int,count(*) filter(where sn.status='promoted')::int
    into v_snapshots,v_promoted
  from public.curriculum_authority_snapshots sn
  join public.curriculum_authority_sources src on src.id=sn.source_id
  where src.canonical_subject_id=v_subject_id and lower(btrim(src.grade))=lower(v_grade);

  select count(*)::int into v_observations
  from public.curriculum_authority_observations obs
  join public.curriculum_authority_snapshots sn on sn.id=obs.snapshot_id
  join public.curriculum_authority_sources src on src.id=sn.source_id
  where src.canonical_subject_id=v_subject_id and lower(btrim(src.grade))=lower(v_grade);

  select count(distinct hb.sub_strand_id)::int into v_bindings
  from public.curriculum_authority_hierarchy_bindings hb
  where hb.canonical_subject_id=v_subject_id and lower(btrim(hb.grade))=lower(v_grade);

  select count(*)::int,
    count(*) filter(where nullif(btrim(coalesce(cs.source_ref,'')),'') is not null)::int,
    count(*) filter(where cardinality(cs.learning_outcomes)>0)::int
    into v_sub_strands,v_sourced_strands,v_populated_strands
  from public.cbc_strands cs
  where cs.subject_id=v_subject_id and lower(btrim(cs.grade))=lower(v_grade)
    and cs.term is null and cs.week is null;

  select count(*)::int,count(*) filter(where clo.status='verified')::int
    into v_outcomes,v_verified
  from public.curriculum_learning_outcomes clo
  join public.cbc_strands cs on cs.id=clo.sub_strand_id
  where cs.subject_id=v_subject_id and lower(btrim(cs.grade))=lower(v_grade)
    and clo.source_type='official' and clo.status in ('active','verified');

  select count(*)::int into v_blueprints from public.content_assessment_blueprints
  where subject_id=v_subject_id and status in ('approved','published','active');

  select count(*)::int into v_bank_questions from public.assessment_questions
  where subject_id=v_subject_id and review_status='approved'
    and learning_outcome_id in (
      select clo.id from public.curriculum_learning_outcomes clo
      join public.cbc_strands cs on cs.id=clo.sub_strand_id
      where cs.subject_id=v_subject_id and lower(btrim(cs.grade))=lower(v_grade)
        and clo.source_type='official' and clo.status='verified'
    );

  select count(distinct ai.id)::int,
    count(distinct ai.id) filter(where clo.status='verified' and clo.source_type='official'
      and clo.sub_strand_id in (
       select cs.id from public.cbc_strands cs
       where cs.subject_id=v_subject_id and lower(btrim(cs.grade))=lower(v_grade)
      ))::int
    into v_pilot_items,v_pilot_verified_items
  from public.assessment_items ai
  join public.assessment_definitions ad on ad.id=ai.assessment_id
  left join public.assessment_item_outcomes aio on aio.assessment_item_id=ai.id
  left join public.curriculum_learning_outcomes clo on clo.id=aio.outcome_id
  where ad.subject_id=v_subject_id and ad.generation_metadata->>'audience'='public_practice'
    and lower(coalesce(ad.generation_metadata->>'grade',''))=lower(v_grade);

  if v_approved_sources=0 then v_issues:=v_issues||'"approved_source_missing"'::jsonb; end if;
  if v_promoted=0 then v_issues:=v_issues||'"promoted_snapshot_missing"'::jsonb; end if;
  if v_bindings=0 then v_issues:=v_issues||'"hierarchy_bindings_missing"'::jsonb; end if;
  if v_verified=0 then v_issues:=v_issues||'"verified_outcomes_missing"'::jsonb; end if;
  if v_blueprints=0 then v_issues:=v_issues||'"approved_blueprint_missing"'::jsonb; end if;
  if v_bank_questions=0 then v_issues:=v_issues||'"approved_outcome_question_bank_missing"'::jsonb; end if;
  if v_pilot_items>v_pilot_verified_items then
    v_issues:=v_issues||'"unverified_existing_pilot_questions"'::jsonb; end if;

  return jsonb_build_object(
    'grade',v_grade,'subject',v_subject,'subject_id',v_subject_id,
    'ready_for_curriculum_verified_exam',jsonb_array_length(v_issues)=0,
    'issues',v_issues,
    'sources',v_sources,'approved_sources',v_approved_sources,
    'snapshots',v_snapshots,'promoted_snapshots',v_promoted,
    'source_observations',v_observations,'hierarchy_bindings',v_bindings,
    'sub_strands',v_sub_strands,'sub_strands_with_source',v_sourced_strands,
    'sub_strands_with_outcomes',v_populated_strands,
    'official_outcomes',v_outcomes,'verified_official_outcomes',v_verified,
    'approved_blueprints',v_blueprints,'verified_bank_questions',v_bank_questions,
    'existing_public_pilot_items',v_pilot_items,
    'existing_pilot_items_linked_to_verified_outcomes',v_pilot_verified_items,
    'report_only',true
  );
end
$fn$;
revoke all on function public.hq_curriculum_exam_readiness(text,text) from public,anon;
grant execute on function public.hq_curriculum_exam_readiness(text,text) to authenticated;
