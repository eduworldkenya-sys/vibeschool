begin;

-- One-time, audited convergence for the already owner-verified KICD Grade 10
-- Chemistry cohort. Verified outcome immutability remains the default and is
-- restored before this transaction commits. Only NULL -> exact source-bound
-- sub_strand_id plus updated_at is permitted during the bounded repair.

create table if not exists public.curriculum_verified_outcome_hierarchy_repair_audit (
  id uuid primary key default gen_random_uuid(),
  curriculum_import_id uuid not null references public.curriculum_imports(id) on delete restrict,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete restrict,
  snapshot_id uuid not null references public.curriculum_authority_snapshots(id) on delete restrict,
  previous_sub_strand_id uuid,
  bound_sub_strand_id uuid not null references public.cbc_strands(id) on delete restrict,
  source_binding_id uuid not null references public.curriculum_authority_hierarchy_bindings(id) on delete restrict,
  authorized_by uuid not null references auth.users(id) on delete restrict,
  repair_reason text not null check (repair_reason='verified_kicd_hierarchy_provenance_completion'),
  repaired_at timestamptz not null default clock_timestamp(),
  unique(curriculum_import_id,outcome_id,snapshot_id)
);

alter table public.curriculum_verified_outcome_hierarchy_repair_audit enable row level security;
revoke all on table public.curriculum_verified_outcome_hierarchy_repair_audit from public,anon,authenticated;
grant all on table public.curriculum_verified_outcome_hierarchy_repair_audit to service_role;

create or replace function public.curriculum_verified_outcome_immutable()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if old.status='verified' and to_jsonb(new) is distinct from to_jsonb(old) then
    if current_setting('vibeschool.curriculum_verified_hierarchy_repair',true)='on'
       and old.sub_strand_id is null
       and new.sub_strand_id is not null
       and (to_jsonb(new)-'sub_strand_id'-'updated_at')
           is not distinct from (to_jsonb(old)-'sub_strand_id'-'updated_at')
    then
      return new;
    end if;
    raise exception 'VERIFIED_CURRICULUM_OUTCOME_IMMUTABLE';
  end if;
  return new;
end $$;

do $$
declare
  v_import_id uuid;
  v_snapshot_id uuid;
  v_import_count integer;
  v_matches integer;
  v_updated integer;
begin
  select count(*)::integer,(array_agg(ci.id order by ci.id))[1]
  into v_import_count,v_import_id
  from public.curriculum_imports ci
  where ci.status='verified'
    and ci.source_type='official'
    and lower(ci.subject)='chemistry'
    and replace(lower(ci.grade),' ','')='grade10'
    and ci.version_label='July 2025'
    and ci.source_url='https://drive.google.com/file/d/1R293rOfFoxio7GqwY-mVAolmLDnnHnQ2/preview'
    and ci.content_sha256 ~ '^[0-9a-f]{64}$'
    and coalesce(ci.payload->>'curriculum_authority_snapshot_id','')<>'';

  if v_import_count=0 then return; end if;
  if v_import_count<>1 then raise exception 'EXACT_ONE_VERIFIED_KICD_CHEMISTRY_IMPORT_REQUIRED'; end if;

  select (payload->>'curriculum_authority_snapshot_id')::uuid
  into v_snapshot_id
  from public.curriculum_imports
  where id=v_import_id;

  if not exists(
    select 1
    from public.curriculum_authority_snapshots s
    join public.curriculum_authority_sources src on src.id=s.source_id
    where s.id=v_snapshot_id and s.status='reconciled' and s.observation_count=32
      and src.source_status='approved'
      and lower(src.authority_name) like '%kenya institute of curriculum development%'
      and lower(src.subject_label)='chemistry'
      and replace(lower(src.grade),' ','')='grade10'
      and src.source_version='July 2025'
  ) then raise exception 'RECONCILED_KICD_CHEMISTRY_SNAPSHOT_REQUIRED'; end if;

  if (select count(*) from public.curriculum_authority_hierarchy_bindings
      where snapshot_id=v_snapshot_id)<>7
  then raise exception 'EXACT_SEVEN_HIERARCHY_BINDINGS_REQUIRED'; end if;

  if (select count(*) from public.curriculum_authority_reconciliation
      where snapshot_id=v_snapshot_id)<>32
     or (select count(*) from public.curriculum_authority_reconciliation
         where snapshot_id=v_snapshot_id and classification='missing_outcome')<>32
  then raise exception 'EXPECTED_32_MISSING_OUTCOMES_REQUIRED'; end if;

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
   and clo.outcome_code='CHEM-G10-' || upper(regexp_replace(o.outcome_code,'\.([^.]+)$','-\1'))
   and public.curriculum_authority_normalize_text(trim(trailing '.' from clo.outcome_text))=
       public.curriculum_authority_normalize_text(trim(trailing '.' from o.outcome_text))
  where r.snapshot_id=v_snapshot_id and r.classification='missing_outcome';

  if v_matches<>32 then raise exception 'EXACT_32_CODE_TEXT_HIERARCHY_MATCHES_REQUIRED'; end if;

  insert into public.curriculum_verified_outcome_hierarchy_repair_audit(
    curriculum_import_id,outcome_id,snapshot_id,previous_sub_strand_id,
    bound_sub_strand_id,source_binding_id,authorized_by,repair_reason
  )
  select v_import_id,clo.id,v_snapshot_id,clo.sub_strand_id,
    r.target_sub_strand_id,h.id,h.bound_by,'verified_kicd_hierarchy_provenance_completion'
  from public.curriculum_authority_reconciliation r
  join public.curriculum_authority_observations o on o.id=r.observation_id
  join public.curriculum_authority_hierarchy_bindings h
    on h.snapshot_id=v_snapshot_id and h.sub_strand_id=r.target_sub_strand_id
  join public.curriculum_learning_outcomes clo
    on clo.source_import_id=v_import_id
   and clo.source_type='official'
   and clo.status='verified'
   and clo.sub_strand_id is null
   and clo.outcome_code='CHEM-G10-' || upper(regexp_replace(o.outcome_code,'\.([^.]+)$','-\1'))
   and public.curriculum_authority_normalize_text(trim(trailing '.' from clo.outcome_text))=
       public.curriculum_authority_normalize_text(trim(trailing '.' from o.outcome_text))
  where r.snapshot_id=v_snapshot_id and r.classification='missing_outcome';

  perform set_config('vibeschool.curriculum_verified_hierarchy_repair','on',true);

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
    and clo.outcome_code='CHEM-G10-' || upper(regexp_replace(o.outcome_code,'\.([^.]+)$','-\1'))
    and public.curriculum_authority_normalize_text(trim(trailing '.' from clo.outcome_text))=
        public.curriculum_authority_normalize_text(trim(trailing '.' from o.outcome_text));
  get diagnostics v_updated=row_count;

  perform set_config('vibeschool.curriculum_verified_hierarchy_repair','off',true);

  if v_updated<>32 then raise exception 'CHEMISTRY_HIERARCHY_REPAIR_INCOMPLETE'; end if;
  if (select count(*) from public.curriculum_verified_outcome_hierarchy_repair_audit
      where curriculum_import_id=v_import_id and snapshot_id=v_snapshot_id)<>32
  then raise exception 'CHEMISTRY_HIERARCHY_AUDIT_INCOMPLETE'; end if;
  if (select count(*) from public.curriculum_learning_outcomes
      where source_import_id=v_import_id and status='verified'
        and outcome_code like 'CHEM-G10-%' and sub_strand_id is not null)<>32
  then raise exception 'VERIFIED_HIERARCHY_BOUND_COHORT_INCOMPLETE'; end if;

  delete from public.curriculum_authority_reconciliation where snapshot_id=v_snapshot_id;
  update public.curriculum_authority_snapshots
  set status='sealed',reconciled_at=null,updated_at=clock_timestamp()
  where id=v_snapshot_id;
end $$;

-- Restore the canonical strict immutability function before commit.
create or replace function public.curriculum_verified_outcome_immutable()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if old.status='verified' and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'VERIFIED_CURRICULUM_OUTCOME_IMMUTABLE';
  end if;
  return new;
end $$;

commit;
