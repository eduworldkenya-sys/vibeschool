begin;

-- Converge the official observation code format (for example 1.1.a) with the
-- verified canonical outcome code format (CHEM-G10-1.1-A). Exact outcome text,
-- import, source status, target hierarchy provenance, and the full 32-row cohort
-- must all agree before any row is changed.

do $$
declare
  v_import_id constant uuid := 'cb335e35-3460-4c16-a3d1-1fb90bf4fb16';
  v_snapshot_id constant uuid := 'e27363e0-9195-40f2-a2e9-b9b72e13c9a0';
  v_matches integer;
  v_updated integer;
begin
  if not exists(
    select 1 from public.curriculum_imports
    where id=v_import_id and status='verified' and source_type='official'
      and lower(subject)='chemistry' and replace(lower(grade),' ','')='grade10'
      and version_label='July 2025' and content_sha256 ~ '^[0-9a-f]{64}$'
  ) then raise exception 'VERIFIED_GRADE10_CHEMISTRY_IMPORT_REQUIRED'; end if;

  if not exists(
    select 1 from public.curriculum_authority_snapshots s
    join public.curriculum_authority_sources src on src.id=s.source_id
    where s.id=v_snapshot_id and s.status='reconciled' and s.observation_count=32
      and src.source_status='approved'
      and lower(src.authority_name) like '%kenya institute of curriculum development%'
      and lower(src.subject_label)='chemistry'
      and replace(lower(src.grade),' ','')='grade10'
      and src.source_version='July 2025'
  ) then raise exception 'RECONCILED_KICD_CHEMISTRY_SNAPSHOT_REQUIRED'; end if;

  if (select count(*) from public.curriculum_authority_hierarchy_bindings where snapshot_id=v_snapshot_id)<>7
  then raise exception 'EXACT_SEVEN_HIERARCHY_BINDINGS_REQUIRED'; end if;

  select count(*) into v_matches
  from public.curriculum_authority_reconciliation r
  join public.curriculum_authority_observations o on o.id=r.observation_id
  join public.curriculum_authority_hierarchy_bindings h
    on h.snapshot_id=v_snapshot_id and h.sub_strand_id=r.target_sub_strand_id
  join public.curriculum_learning_outcomes clo
    on clo.source_import_id=v_import_id
   and clo.source_type='official'
   and clo.status='verified'
   and clo.sub_strand_id is null
   and clo.outcome_code =
       'CHEM-G10-' || upper(regexp_replace(o.outcome_code,'\.([^.]+)$','-\1'))
   and public.curriculum_authority_normalize_text(trim(trailing '.' from clo.outcome_text))=
       public.curriculum_authority_normalize_text(trim(trailing '.' from o.outcome_text))
  where r.snapshot_id=v_snapshot_id and r.classification='missing_outcome';

  if v_matches<>32 then raise exception 'EXACT_32_CODE_AND_TEXT_MATCHES_REQUIRED'; end if;

  update public.curriculum_learning_outcomes clo
  set sub_strand_id=r.target_sub_strand_id,updated_at=clock_timestamp()
  from public.curriculum_authority_reconciliation r
  join public.curriculum_authority_observations o on o.id=r.observation_id
  join public.curriculum_authority_hierarchy_bindings h
    on h.snapshot_id=v_snapshot_id and h.sub_strand_id=r.target_sub_strand_id
  where r.snapshot_id=v_snapshot_id
    and r.classification='missing_outcome'
    and clo.source_import_id=v_import_id
    and clo.source_type='official'
    and clo.status='verified'
    and clo.sub_strand_id is null
    and clo.outcome_code =
        'CHEM-G10-' || upper(regexp_replace(o.outcome_code,'\.([^.]+)$','-\1'))
    and public.curriculum_authority_normalize_text(trim(trailing '.' from clo.outcome_text))=
        public.curriculum_authority_normalize_text(trim(trailing '.' from o.outcome_text));
  get diagnostics v_updated=row_count;
  if v_updated<>32 then raise exception 'CHEMISTRY_CODE_CONVERGENCE_INCOMPLETE'; end if;

  if (select count(*) from public.curriculum_learning_outcomes
      where source_import_id=v_import_id and status='verified'
        and outcome_code like 'CHEM-G10-%' and sub_strand_id is not null)<>32
  then raise exception 'VERIFIED_HIERARCHY_BOUND_COHORT_INCOMPLETE'; end if;

  delete from public.curriculum_authority_reconciliation where snapshot_id=v_snapshot_id;
  update public.curriculum_authority_snapshots
  set status='sealed',reconciled_at=null,updated_at=clock_timestamp()
  where id=v_snapshot_id;
end $$;

commit;
