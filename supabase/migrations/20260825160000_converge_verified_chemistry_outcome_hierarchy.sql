begin;

-- One-time bounded convergence for the already owner-verified KICD Grade 10
-- Chemistry July 2025 cohort. A blank reconstruction has no production cohort,
-- so zero matching imports is an intentional no-op. If a matching cohort does
-- exist, every production invariant below remains fail-closed.
do $$
declare
  v_import_id uuid;
  v_snapshot_id uuid;
  v_import_count integer;
  v_updated integer;
begin
  select count(*)::integer, (array_agg(ci.id order by ci.id))[1]
  into v_import_count, v_import_id
  from public.curriculum_imports ci
  where ci.status='verified'
    and ci.source_type='official'
    and lower(ci.subject)='chemistry'
    and replace(lower(ci.grade),' ','')='grade10'
    and ci.version_label='July 2025'
    and ci.source_url='https://drive.google.com/file/d/1R293rOfFoxio7GqwY-mVAolmLDnnHnQ2/preview'
    and ci.content_sha256 ~ '^[0-9a-f]{64}$'
    and coalesce(ci.payload->>'curriculum_authority_snapshot_id','')<>'';

  if v_import_count=0 then
    return;
  end if;
  if v_import_count<>1 then raise exception 'EXACT_ONE_VERIFIED_KICD_CHEMISTRY_IMPORT_REQUIRED'; end if;

  select (ci.payload->>'curriculum_authority_snapshot_id')::uuid
  into v_snapshot_id
  from public.curriculum_imports ci
  where ci.id=v_import_id;

  if not exists(
    select 1 from public.curriculum_authority_snapshots s
    join public.curriculum_authority_sources src on src.id=s.source_id
    where s.id=v_snapshot_id
      and s.status='reconciled'
      and s.observation_count=32
      and src.source_status='approved'
      and lower(src.authority_name) like '%kenya institute of curriculum development%'
      and lower(src.subject_label)='chemistry'
      and replace(lower(src.grade),' ','')='grade10'
      and src.source_version='July 2025'
  ) then raise exception 'RECONCILED_KICD_CHEMISTRY_SNAPSHOT_REQUIRED'; end if;

  if (select count(*) from public.curriculum_authority_hierarchy_bindings h where h.snapshot_id=v_snapshot_id)<>7 then
    raise exception 'EXACT_SEVEN_HIERARCHY_BINDINGS_REQUIRED';
  end if;
  if (select count(*) from public.curriculum_authority_reconciliation r where r.snapshot_id=v_snapshot_id)<>32
     or (select count(*) from public.curriculum_authority_reconciliation r where r.snapshot_id=v_snapshot_id and r.classification='missing_outcome')<>32 then
    raise exception 'EXPECTED_32_MISSING_OUTCOMES_REQUIRED';
  end if;
  if (select count(*) from public.curriculum_learning_outcomes clo
      where clo.source_import_id=v_import_id and clo.source_type='official' and clo.status='verified'
        and clo.outcome_code like 'CHEM-G10-%' and clo.sub_strand_id is null)<>32 then
    raise exception 'VERIFIED_32_OUTCOME_COHORT_REQUIRED';
  end if;

  if exists(
    select 1
    from public.curriculum_authority_reconciliation r
    join public.curriculum_authority_observations o on o.id=r.observation_id
    left join public.curriculum_learning_outcomes clo
      on clo.source_import_id=v_import_id
     and clo.source_type='official'
     and clo.status='verified'
     and public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code)
     and public.curriculum_authority_normalize_text(clo.outcome_text)=public.curriculum_authority_normalize_text(o.outcome_text)
    left join public.curriculum_authority_hierarchy_bindings h
      on h.snapshot_id=v_snapshot_id and h.sub_strand_id=r.target_sub_strand_id
    where r.snapshot_id=v_snapshot_id
      and (r.target_sub_strand_id is null or clo.id is null or h.sub_strand_id is null)
  ) then raise exception 'OUTCOME_HIERARCHY_PROVENANCE_INCOMPLETE'; end if;

  update public.curriculum_learning_outcomes clo
  set sub_strand_id=r.target_sub_strand_id,
      updated_at=clock_timestamp()
  from public.curriculum_authority_reconciliation r
  join public.curriculum_authority_observations o on o.id=r.observation_id
  where r.snapshot_id=v_snapshot_id
    and r.classification='missing_outcome'
    and r.target_sub_strand_id is not null
    and clo.source_import_id=v_import_id
    and clo.source_type='official'
    and clo.status='verified'
    and clo.sub_strand_id is null
    and public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code)
    and public.curriculum_authority_normalize_text(clo.outcome_text)=public.curriculum_authority_normalize_text(o.outcome_text);
  get diagnostics v_updated=row_count;
  if v_updated<>32 then raise exception 'CHEMISTRY_HIERARCHY_CONVERGENCE_INCOMPLETE'; end if;

  delete from public.curriculum_authority_reconciliation where snapshot_id=v_snapshot_id;
  update public.curriculum_authority_snapshots
  set status='sealed',reconciled_at=null,updated_at=clock_timestamp()
  where id=v_snapshot_id;
end $$;

commit;
