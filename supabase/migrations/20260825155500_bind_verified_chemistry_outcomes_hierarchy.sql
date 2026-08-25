begin;

-- After exact hierarchy binding, attach the already owner-verified Grade 10
-- Chemistry KICD outcomes to the exact reconciled sub-strand rows. This is a
-- provenance repair only: it does not create, verify, publish, schedule, or run
-- content. Fresh reconciliation is required afterward.

create or replace function public.hq_bind_verified_grade10_chemistry_outcomes_hierarchy(
  p_import_id uuid,
  p_snapshot_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_import public.curriculum_imports%rowtype;
  v_snapshot public.curriculum_authority_snapshots%rowtype;
  v_source public.curriculum_authority_sources%rowtype;
  v_expected integer;
  v_updated integer;
begin
  perform public.hq_assert_owner();

  select * into v_import from public.curriculum_imports where id=p_import_id for update;
  if not found or v_import.status<>'verified' or v_import.source_type<>'official' or lower(v_import.subject)<>'chemistry' or replace(lower(v_import.grade),' ','')<>'grade10' or v_import.version_label<>'July 2025' or v_import.content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'VERIFIED_GRADE10_CHEMISTRY_IMPORT_REQUIRED';
  end if;

  select * into v_snapshot from public.curriculum_authority_snapshots where id=p_snapshot_id for update;
  if not found or v_snapshot.status<>'reconciled' or v_snapshot.observation_count<>32 then raise exception 'RECONCILED_32_OBSERVATION_SNAPSHOT_REQUIRED'; end if;

  select * into v_source from public.curriculum_authority_sources where id=v_snapshot.source_id;
  if not found or v_source.source_status<>'approved' or lower(v_source.authority_name) not like '%kenya institute of curriculum development%' or lower(v_source.subject_label)<>'chemistry' or replace(lower(v_source.grade),' ','')<>'grade10' or v_source.source_version<>'July 2025' then raise exception 'EXACT_KICD_CHEMISTRY_SOURCE_REQUIRED'; end if;

  if coalesce(v_import.payload->>'curriculum_authority_snapshot_id','')<>p_snapshot_id::text then raise exception 'IMPORT_SNAPSHOT_PROVENANCE_MISMATCH'; end if;
  if (select count(*) from public.curriculum_authority_hierarchy_bindings h where h.snapshot_id=p_snapshot_id)<>7 then raise exception 'EXACT_SEVEN_HIERARCHY_BINDINGS_REQUIRED'; end if;
  if (select count(*) from public.curriculum_authority_reconciliation r where r.snapshot_id=p_snapshot_id)<>32 or (select count(*) from public.curriculum_authority_reconciliation r where r.snapshot_id=p_snapshot_id and r.classification='missing_outcome')<>32 then raise exception 'EXPECTED_32_MISSING_OUTCOMES_REQUIRED'; end if;

  if exists(
    select 1
    from public.curriculum_authority_reconciliation r
    join public.curriculum_authority_observations o on o.id=r.observation_id
    left join public.curriculum_learning_outcomes clo
      on clo.source_import_id=p_import_id and clo.source_type='official' and clo.status='verified'
     and public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code)
     and public.curriculum_authority_normalize_text(clo.outcome_text)=public.curriculum_authority_normalize_text(o.outcome_text)
    left join public.curriculum_authority_hierarchy_bindings h on h.snapshot_id=p_snapshot_id and h.sub_strand_id=r.target_sub_strand_id
    where r.snapshot_id=p_snapshot_id and (r.target_sub_strand_id is null or clo.id is null or h.sub_strand_id is null)
  ) then raise exception 'OUTCOME_HIERARCHY_PROVENANCE_INCOMPLETE'; end if;

  select count(*) into v_expected
  from public.curriculum_learning_outcomes clo
  where clo.source_import_id=p_import_id and clo.source_type='official' and clo.status='verified' and clo.outcome_code like 'CHEM-G10-%' and clo.sub_strand_id is null;
  if v_expected<>32 then raise exception 'VERIFIED_OUTCOME_COHORT_DRIFT'; end if;

  update public.curriculum_learning_outcomes clo
  set sub_strand_id=r.target_sub_strand_id, updated_at=clock_timestamp()
  from public.curriculum_authority_reconciliation r
  join public.curriculum_authority_observations o on o.id=r.observation_id
  where r.snapshot_id=p_snapshot_id and r.classification='missing_outcome' and r.target_sub_strand_id is not null
    and clo.source_import_id=p_import_id and clo.source_type='official' and clo.status='verified' and clo.sub_strand_id is null
    and public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code)
    and public.curriculum_authority_normalize_text(clo.outcome_text)=public.curriculum_authority_normalize_text(o.outcome_text);
  get diagnostics v_updated=row_count;
  if v_updated<>32 then raise exception 'CHEMISTRY_HIERARCHY_BINDING_INCOMPLETE'; end if;

  delete from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id;
  update public.curriculum_authority_snapshots set status='sealed',reconciled_at=null,updated_at=clock_timestamp() where id=p_snapshot_id;

  return jsonb_build_object('ok',true,'import_id',p_import_id,'snapshot_id',p_snapshot_id,'bound_outcomes',v_updated,'requires_fresh_reconciliation',true);
end $$;

revoke all on function public.hq_bind_verified_grade10_chemistry_outcomes_hierarchy(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.hq_bind_verified_grade10_chemistry_outcomes_hierarchy(uuid,uuid) to authenticated;
comment on function public.hq_bind_verified_grade10_chemistry_outcomes_hierarchy(uuid,uuid) is 'Owner-gated repair that binds exactly 32 already-verified Grade 10 Chemistry KICD outcomes to their exact source-bound hierarchy, then requires fresh reconciliation.';
commit;
