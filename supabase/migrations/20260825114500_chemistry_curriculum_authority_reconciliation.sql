begin;

-- Reconcile the prematurely-active Grade 10 Chemistry outcome cohort with the
-- exact KICD July 2025 wording. Nothing is verified, published, scheduled, or
-- executed by this migration. Both preparation and verification remain
-- authenticated HQ-owner actions and fail closed on any source/cohort drift.

-- access: service-only public.curriculum_outcome_reconciliation_audit
-- authorization-test: public.curriculum_outcome_reconciliation_audit is denied
-- to anon/authenticated; owner mutations occur only through the audited RPCs.

create table if not exists public.curriculum_outcome_reconciliation_audit (
  id uuid primary key default gen_random_uuid(),
  curriculum_import_id uuid not null references public.curriculum_imports(id) on delete restrict,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete restrict,
  action text not null check (action in ('prepared_exact_kicd_wording')),
  previous_record jsonb not null,
  replacement_record jsonb not null,
  source_snapshot_id uuid not null references public.curriculum_authority_snapshots(id) on delete restrict,
  reconciled_by uuid not null references auth.users(id) on delete restrict,
  reconciled_at timestamptz not null default clock_timestamp(),
  unique(curriculum_import_id,outcome_id,action)
);

alter table public.curriculum_outcome_reconciliation_audit enable row level security;
revoke all on table public.curriculum_outcome_reconciliation_audit from public,anon,authenticated;
grant all on table public.curriculum_outcome_reconciliation_audit to service_role;

create or replace function public.hq_prepare_grade10_chemistry_authority(
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
  v_artifact public.curriculum_authority_artifacts%rowtype;
  v_expected integer;
  v_updated integer;
begin
  perform public.hq_assert_owner();
  select * into v_import from public.curriculum_imports where id=p_import_id for update;
  if not found or v_import.status<>'draft' then raise exception 'DRAFT_CURRICULUM_IMPORT_REQUIRED'; end if;
  select * into v_snapshot from public.curriculum_authority_snapshots where id=p_snapshot_id;
  if not found then raise exception 'CURRICULUM_AUTHORITY_SNAPSHOT_NOT_FOUND'; end if;
  select * into v_source from public.curriculum_authority_sources where id=v_snapshot.source_id;
  select * into v_artifact from public.curriculum_authority_artifacts where id=v_snapshot.artifact_id;
  if v_source.source_status<>'approved'
     or lower(v_source.authority_name) not like '%kenya institute of curriculum development%'
     or replace(lower(v_source.grade),' ','')<>'grade10'
     or lower(v_source.subject_label)<>'chemistry'
     or v_source.source_version<>'July 2025'
     or v_source.source_url<>'https://drive.google.com/file/d/1R293rOfFoxio7GqwY-mVAolmLDnnHnQ2/preview'
     or v_artifact.source_id<>v_source.id
     or v_artifact.content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'EXACT_APPROVED_KICD_CHEMISTRY_ARTIFACT_REQUIRED';
  end if;
  if lower(v_import.subject)<>'chemistry' or replace(lower(v_import.grade),' ','')<>'grade10'
     or lower(v_import.source_type)<>'official' then raise exception 'CURRICULUM_IMPORT_SCOPE_MISMATCH'; end if;

  create temporary table expected_chemistry_outcomes(code text primary key, exact_text text, locator text) on commit drop;
  insert into expected_chemistry_outcomes values
    ('CHEM-G10-1.1-A','explain the meaning of Chemistry as a field of science','printed pages 1-3'),
    ('CHEM-G10-1.1-B','explore the role of Chemistry in day-to-day life','printed pages 1-3'),
    ('CHEM-G10-1.1-C','examine the effects of drug and substance use in day-to-day life','printed pages 1-3'),
    ('CHEM-G10-1.1-D','advocate for a safe and healthy learning environment','printed pages 1-3'),
    ('CHEM-G10-1.2-A','describe the structure of the atom','printed pages 4-6'),
    ('CHEM-G10-1.2-B','determine the relative atomic mass of elements','printed pages 4-6'),
    ('CHEM-G10-1.2-C','write the electron arrangement of elements using s and p notation','printed pages 4-6'),
    ('CHEM-G10-1.2-D','develop interest in the study of structure of the atom','printed pages 4-6'),
    ('CHEM-G10-1.3-A','relate the position of an element in the periodic table to its electron arrangement','printed pages 7-9'),
    ('CHEM-G10-1.3-B','illustrate ion formation of elements','printed pages 7-9'),
    ('CHEM-G10-1.3-C','derive the formulae of compounds','printed pages 7-9'),
    ('CHEM-G10-1.3-D','write balanced equations for chemical reactions','printed pages 7-9'),
    ('CHEM-G10-1.3-E','appreciate the role of electron arrangement in the development of the periodic table','printed pages 7-9'),
    ('CHEM-G10-1.4-A','illustrate bond types in elements, molecules and compounds','printed pages 10-12'),
    ('CHEM-G10-1.4-B','investigate the relationship between bond types and physical properties of elements, molecules and compounds','printed pages 10-12'),
    ('CHEM-G10-1.4-C','relate bond types and resultant structures to the uses of elements, molecules and compounds','printed pages 10-12'),
    ('CHEM-G10-1.4-D','appreciate the uses of different substances based on their bond types and structures in day-to-day life','printed pages 10-12'),
    ('CHEM-G10-1.5-A','describe the trends in physical properties of elements of the periodic table','printed pages 13-16'),
    ('CHEM-G10-1.5-B','investigate the chemical properties of elements in groups of the periodic table','printed pages 13-16'),
    ('CHEM-G10-1.5-C','describe the trends in properties across a period','printed pages 13-16'),
    ('CHEM-G10-1.5-D','outline applications of elements of the periodic table','printed pages 13-16'),
    ('CHEM-G10-1.5-E','appreciate applications of various elements of the periodic table','printed pages 13-16'),
    ('CHEM-G10-2.1-A','explain the characteristics of acids and bases in aqueous solutions','printed pages 19-20'),
    ('CHEM-G10-2.1-B','describe the chemical properties of acids and bases','printed pages 19-20'),
    ('CHEM-G10-2.1-C','investigate the strength of acids and bases using the acid-base indicator','printed pages 19-20'),
    ('CHEM-G10-2.1-D','outline the uses of acids and bases in day to day life','printed pages 19-20'),
    ('CHEM-G10-2.1-E','appreciate the uses of acids and bases in day to day activities','printed pages 19-20'),
    ('CHEM-G10-2.2-A','classify different salts based on their properties.','printed pages 21-23'),
    ('CHEM-G10-2.2-B','prepare salts using appropriate methods in the laboratory','printed pages 21-23'),
    ('CHEM-G10-2.2-C','describe the behaviour of salts when exposed to air','printed pages 21-23'),
    ('CHEM-G10-2.2-D','outline applications of salts in day-to-day life','printed pages 21-23'),
    ('CHEM-G10-2.2-E','appreciate the applications of salts in day-to-day life.','printed pages 21-23');

  select count(*) into v_expected from expected_chemistry_outcomes;
  if v_expected<>32 or (select count(*) from public.curriculum_learning_outcomes o join expected_chemistry_outcomes e on e.code=o.outcome_code
      where o.source_type='official' and o.status='active' and o.verified_at is null and o.source_import_id is null
        and o.source_ref like '%google-drive:1R293rOfFoxio7GqwY-mVAolmLDnnHnQ2')<>32 then
    raise exception 'CHEMISTRY_OUTCOME_COHORT_DRIFT';
  end if;

  insert into public.curriculum_outcome_reconciliation_audit(
    curriculum_import_id,outcome_id,action,previous_record,replacement_record,source_snapshot_id,reconciled_by)
  select p_import_id,o.id,'prepared_exact_kicd_wording',to_jsonb(o),
    to_jsonb(o)||jsonb_build_object('outcome_text',e.exact_text,'status','draft','source_import_id',p_import_id,'source_locator',e.locator),
    p_snapshot_id,auth.uid()
  from public.curriculum_learning_outcomes o join expected_chemistry_outcomes e on e.code=o.outcome_code
  where o.source_type='official' and o.status='active' and o.verified_at is null and o.source_import_id is null
  on conflict do nothing;

  update public.curriculum_learning_outcomes o set outcome_text=e.exact_text,status='draft',source_import_id=p_import_id,
    source_locator=e.locator,updated_at=clock_timestamp()
  from expected_chemistry_outcomes e where o.outcome_code=e.code and o.source_type='official'
    and o.status='active' and o.verified_at is null and o.source_import_id is null;
  get diagnostics v_updated=row_count;
  if v_updated<>32 then raise exception 'CHEMISTRY_OUTCOME_PREPARATION_INCOMPLETE'; end if;

  update public.curriculum_imports set authority_name=v_source.authority_name,source_url=v_artifact.source_url,
    source_ref='curriculum_authority_snapshot:'||p_snapshot_id::text,version_label=v_artifact.source_version,
    content_sha256=v_artifact.content_sha256,payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
      'curriculum_authority_source_id',v_source.id,'curriculum_authority_snapshot_id',p_snapshot_id,
      'curriculum_authority_artifact_id',v_artifact.id,'parent_authority_page',v_source.metadata->>'parent_authority_page'),
    updated_at=clock_timestamp() where id=p_import_id;
  return jsonb_build_object('import_id',p_import_id,'snapshot_id',p_snapshot_id,'prepared_outcomes',32,
    'artifact_sha256',v_artifact.content_sha256,'verified',false,'next_action','OWNER_VERIFY_EXACT_KICD_AUTHORITY');
end $$;

create or replace function public.hq_verify_grade10_chemistry_authority(p_import_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count integer;
begin
  perform public.hq_assert_owner();
  if not exists(select 1 from public.curriculum_imports where id=p_import_id and status='draft'
      and source_type='official' and lower(subject)='chemistry' and replace(lower(grade),' ','')='grade10'
      and content_sha256 ~ '^[0-9a-f]{64}$' and version_label='July 2025') then
    raise exception 'PREPARED_KICD_CHEMISTRY_IMPORT_REQUIRED';
  end if;
  if (select count(*) from public.curriculum_learning_outcomes where source_import_id=p_import_id
      and status='draft' and source_type='official' and outcome_code like 'CHEM-G10-%'
      and source_locator like 'printed pages %')<>32 then raise exception 'EXACT_32_OUTCOMES_REQUIRED'; end if;
  update public.curriculum_imports set status='verified',verified_by=auth.uid(),verified_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_import_id;
  update public.curriculum_learning_outcomes set status='verified',verified_by=auth.uid(),verified_at=clock_timestamp(),updated_at=clock_timestamp()
    where source_import_id=p_import_id and status='draft' and source_type='official' and outcome_code like 'CHEM-G10-%';
  get diagnostics v_count=row_count;
  if v_count<>32 then raise exception 'CHEMISTRY_AUTHORITY_VERIFICATION_INCOMPLETE'; end if;
  return jsonb_build_object('import_id',p_import_id,'verified_outcomes',v_count,'verified',true);
end $$;

revoke all on function public.hq_prepare_grade10_chemistry_authority(uuid,uuid),
  public.hq_verify_grade10_chemistry_authority(uuid) from public,anon,authenticated,service_role;
grant execute on function public.hq_prepare_grade10_chemistry_authority(uuid,uuid),
  public.hq_verify_grade10_chemistry_authority(uuid) to authenticated;

commit;
