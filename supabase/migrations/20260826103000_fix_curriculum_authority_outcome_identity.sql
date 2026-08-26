-- Canonicalize outcome identity across the general Curriculum Authority pipeline
-- and the Grade 10 Chemistry authority pipeline. The same KICD outcome may be
-- encoded as `1.1.a` or `CHEM-G10-1.1-A`. Terminal punctuation differences in
-- exact source text must not create duplicate official outcomes.

create or replace function public.curriculum_authority_normalize_outcome_code(p_code text)
returns text language sql immutable set search_path to '' as $$
  select regexp_replace(regexp_replace(lower(coalesce(p_code,'')), '^chem-g10-', ''), '[^a-z0-9]+', '', 'g')
$$;

create or replace function public.curriculum_authority_normalize_outcome_text(p_text text)
returns text language sql immutable set search_path to '' as $$
  select regexp_replace(public.curriculum_authority_normalize_text(coalesce(p_text,'')), '[[:punct:][:space:]]+$', '', 'g')
$$;

create or replace function public.curriculum_authority_reconcile_snapshot(p_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_snapshot public.curriculum_authority_snapshots%rowtype; v_source public.curriculum_authority_sources%rowtype;
  v_count integer; v_hash text; o record; v_hierarchy_count integer; v_sub_strand_id uuid;
  v_official_exact uuid; v_official_code_conflict uuid; v_creator_exact uuid; v_classification text; v_counts jsonb:='{}'::jsonb;
begin
  select * into v_snapshot from public.curriculum_authority_snapshots where id=p_snapshot_id for update;
  if not found then raise exception 'snapshot_not_found'; end if;
  if v_snapshot.status not in ('sealed','reconciled') then raise exception 'snapshot_not_sealed'; end if;
  select * into v_source from public.curriculum_authority_sources where id=v_snapshot.source_id;
  if not found or v_source.source_status<>'approved' then raise exception 'source_not_approved'; end if;
  select count(*)::integer,encode(extensions.digest(convert_to(coalesce(string_agg(row_sha256,'|' order by observation_key),''),'UTF8'),'sha256'),'hex')
    into v_count,v_hash from public.curriculum_authority_observations where snapshot_id=p_snapshot_id;
  if v_count is distinct from v_snapshot.observation_count then raise exception 'sealed_snapshot_count_mismatch'; end if;
  if v_hash is distinct from v_snapshot.snapshot_sha256 then raise exception 'sealed_snapshot_checksum_mismatch'; end if;

  delete from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id;
  for o in select * from public.curriculum_authority_observations where snapshot_id=p_snapshot_id order by observation_key loop
    v_hierarchy_count:=0; v_sub_strand_id:=null; v_official_exact:=null; v_official_code_conflict:=null; v_creator_exact:=null;
    if public.curriculum_authority_normalize_text(o.curriculum_framework)<>public.curriculum_authority_normalize_text(v_source.curriculum_framework)
      or public.curriculum_authority_normalize_text(o.grade)<>public.curriculum_authority_normalize_text(v_source.grade)
      or public.curriculum_authority_normalize_text(o.subject_label)<>public.curriculum_authority_normalize_text(v_source.subject_label)
    then v_classification:='scope_mismatch';
    else
      select count(*)::integer,(array_agg(cs.id order by cs.id))[1] into v_hierarchy_count,v_sub_strand_id
      from public.cbc_strands cs where cs.subject_id=v_source.canonical_subject_id
        and public.curriculum_authority_normalize_text(cs.grade)=public.curriculum_authority_normalize_text(v_source.grade)
        and public.curriculum_authority_normalize_text(cs.name)=public.curriculum_authority_normalize_text(o.strand)
        and public.curriculum_authority_normalize_text(coalesce(cs.sub_strand,''))=public.curriculum_authority_normalize_text(o.sub_strand)
        and cs.term is null and cs.week is null;
      if v_hierarchy_count=0 then v_classification:='missing_hierarchy';
      elsif v_hierarchy_count>1 then v_classification:='official_conflict'; v_sub_strand_id:=null;
      else
        select clo.id into v_official_code_conflict from public.curriculum_learning_outcomes clo
        where clo.sub_strand_id=v_sub_strand_id and clo.source_type='official' and clo.status in ('active','verified')
          and nullif(public.curriculum_authority_normalize_outcome_code(o.outcome_code),'') is not null
          and public.curriculum_authority_normalize_outcome_code(clo.outcome_code)=public.curriculum_authority_normalize_outcome_code(o.outcome_code)
          and public.curriculum_authority_normalize_outcome_text(clo.outcome_text)<>public.curriculum_authority_normalize_outcome_text(o.outcome_text)
        order by clo.id limit 1;
        if v_official_code_conflict is not null then v_classification:='official_conflict';
        else
          select clo.id into v_official_exact from public.curriculum_learning_outcomes clo
          where clo.sub_strand_id=v_sub_strand_id and clo.source_type='official' and clo.status in ('active','verified')
            and public.curriculum_authority_normalize_outcome_text(clo.outcome_text)=public.curriculum_authority_normalize_outcome_text(o.outcome_text)
            and (nullif(public.curriculum_authority_normalize_outcome_code(o.outcome_code),'') is null
              or public.curriculum_authority_normalize_outcome_code(clo.outcome_code)=public.curriculum_authority_normalize_outcome_code(o.outcome_code))
          order by clo.id limit 1;
          if v_official_exact is not null then v_classification:='exact_official';
          else
            select clo.id into v_creator_exact from public.curriculum_learning_outcomes clo
            where clo.sub_strand_id=v_sub_strand_id and clo.source_type='creator_claimed' and clo.status in ('draft','active','verified')
              and public.curriculum_authority_normalize_outcome_text(clo.outcome_text)=public.curriculum_authority_normalize_outcome_text(o.outcome_text)
              and (nullif(public.curriculum_authority_normalize_outcome_code(o.outcome_code),'') is null
                or public.curriculum_authority_normalize_outcome_code(clo.outcome_code)=public.curriculum_authority_normalize_outcome_code(o.outcome_code))
            order by clo.id limit 1;
            if v_creator_exact is not null then v_classification:='creator_claimed_replacement_candidate'; else v_classification:='missing_outcome'; end if;
          end if;
        end if;
      end if;
    end if;
    insert into public.curriculum_authority_reconciliation(snapshot_id,observation_id,classification,target_sub_strand_id,target_outcome_id,details)
    values(p_snapshot_id,o.id,v_classification,v_sub_strand_id,coalesce(v_official_exact,v_official_code_conflict,v_creator_exact),
      jsonb_build_object('canonical_subject_id',v_source.canonical_subject_id,'hierarchy_match_count',coalesce(v_hierarchy_count,0),
        'official_code_conflict_id',v_official_code_conflict,'creator_claimed_candidate_id',v_creator_exact));
    v_counts:=jsonb_set(v_counts,array[v_classification],to_jsonb(coalesce((v_counts->>v_classification)::integer,0)+1),true);
  end loop;
  update public.curriculum_authority_snapshots set status='reconciled',reconciled_at=now(),updated_at=now() where id=p_snapshot_id;
  return jsonb_build_object('snapshot_id',p_snapshot_id,'classifications',v_counts);
end $function$;

create or replace function public.curriculum_authority_promote_snapshot(p_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_owner uuid:=auth.uid(); v_snapshot public.curriculum_authority_snapshots%rowtype; v_source public.curriculum_authority_sources%rowtype;
  v_artifact public.curriculum_authority_artifacts%rowtype; v_count integer; v_hash text; r record; v_current_hierarchy_count integer;
  v_current_sub_strand_id uuid; v_existing_official_id uuid; v_conflict_id uuid; v_outcome_id uuid; v_action text;
  v_inserted integer:=0; v_matched integer:=0; v_tags text[];
begin
  perform public.hq_assert_owner(); if v_owner is null then raise exception 'authentication_required'; end if;
  select * into v_snapshot from public.curriculum_authority_snapshots where id=p_snapshot_id for update;
  if not found then raise exception 'snapshot_not_found'; end if; if v_snapshot.status<>'reconciled' then raise exception 'snapshot_not_reconciled'; end if;
  select * into v_source from public.curriculum_authority_sources where id=v_snapshot.source_id;
  select * into v_artifact from public.curriculum_authority_artifacts where id=v_snapshot.artifact_id;
  if v_source.source_status<>'approved' then raise exception 'source_not_approved'; end if; if v_artifact.source_id<>v_source.id then raise exception 'artifact_source_mismatch'; end if;
  select count(*)::integer,encode(extensions.digest(convert_to(coalesce(string_agg(row_sha256,'|' order by observation_key),''),'UTF8'),'sha256'),'hex')
    into v_count,v_hash from public.curriculum_authority_observations where snapshot_id=p_snapshot_id;
  if v_count is distinct from v_snapshot.observation_count then raise exception 'sealed_snapshot_count_mismatch'; end if;
  if v_hash is distinct from v_snapshot.snapshot_sha256 then raise exception 'sealed_snapshot_checksum_mismatch'; end if;
  if (select count(*) from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id)<>v_snapshot.observation_count then raise exception 'snapshot_reconciliation_incomplete'; end if;
  if exists(select 1 from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id and classification in ('official_conflict','scope_mismatch')) then raise exception 'snapshot_has_unresolved_conflicts'; end if;
  if exists(select 1 from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id and classification='missing_hierarchy') then raise exception 'snapshot_requires_hierarchy_resolution'; end if;

  for r in select rr.observation_id,rr.classification,rr.target_sub_strand_id,o.observation_key,o.strand,o.sub_strand,o.outcome_text,o.outcome_code,o.difficulty,o.competencies,o.source_locator
    from public.curriculum_authority_reconciliation rr join public.curriculum_authority_observations o on o.id=rr.observation_id
    where rr.snapshot_id=p_snapshot_id order by o.observation_key loop
    select count(*)::integer,(array_agg(cs.id order by cs.id))[1] into v_current_hierarchy_count,v_current_sub_strand_id
    from public.cbc_strands cs where cs.subject_id=v_source.canonical_subject_id
      and public.curriculum_authority_normalize_text(cs.grade)=public.curriculum_authority_normalize_text(v_source.grade)
      and public.curriculum_authority_normalize_text(cs.name)=public.curriculum_authority_normalize_text(r.strand)
      and public.curriculum_authority_normalize_text(coalesce(cs.sub_strand,''))=public.curriculum_authority_normalize_text(r.sub_strand)
      and cs.term is null and cs.week is null;
    if v_current_hierarchy_count<>1 or v_current_sub_strand_id is distinct from r.target_sub_strand_id then raise exception 'hierarchy_changed_since_reconciliation'; end if;

    v_existing_official_id:=null; v_conflict_id:=null;
    select clo.id into v_conflict_id from public.curriculum_learning_outcomes clo
    where clo.sub_strand_id=v_current_sub_strand_id and clo.source_type='official' and clo.status in ('active','verified')
      and nullif(public.curriculum_authority_normalize_outcome_code(r.outcome_code),'') is not null
      and public.curriculum_authority_normalize_outcome_code(clo.outcome_code)=public.curriculum_authority_normalize_outcome_code(r.outcome_code)
      and public.curriculum_authority_normalize_outcome_text(clo.outcome_text)<>public.curriculum_authority_normalize_outcome_text(r.outcome_text)
    order by clo.id limit 1;
    if v_conflict_id is not null then raise exception 'official_outcome_conflict_at_promotion'; end if;
    select clo.id into v_existing_official_id from public.curriculum_learning_outcomes clo
    where clo.sub_strand_id=v_current_sub_strand_id and clo.source_type='official' and clo.status in ('active','verified')
      and public.curriculum_authority_normalize_outcome_text(clo.outcome_text)=public.curriculum_authority_normalize_outcome_text(r.outcome_text)
      and (nullif(public.curriculum_authority_normalize_outcome_code(r.outcome_code),'') is null
        or public.curriculum_authority_normalize_outcome_code(clo.outcome_code)=public.curriculum_authority_normalize_outcome_code(r.outcome_code))
    order by clo.id limit 1;
    if v_existing_official_id is not null then v_outcome_id:=v_existing_official_id; v_action:='matched_existing_official'; v_matched:=v_matched+1;
    else
      if jsonb_typeof(r.competencies)='array' then select coalesce(array_agg(x),array[]::text[]) into v_tags from jsonb_array_elements_text(r.competencies) x; else v_tags:=array[]::text[]; end if;
      insert into public.curriculum_learning_outcomes(curriculum_id,sub_strand_id,outcome_text,outcome_code,source_type,source_ref,difficulty,competency_tags,status,verified_by,verified_at,created_by,created_at,updated_at)
      values(null,v_current_sub_strand_id,r.outcome_text,nullif(btrim(r.outcome_code),''),'official',v_artifact.source_url||case when r.source_locator is null then '' else '#'||r.source_locator end,
        case when r.difficulty in ('foundation','developing','proficient','advanced') then r.difficulty else null end,coalesce(v_tags,array[]::text[]),'active',v_owner,now(),v_owner,now(),now())
      returning id into v_outcome_id; v_action:='inserted_official'; v_inserted:=v_inserted+1;
    end if;
    insert into public.curriculum_authority_promotions(snapshot_id,observation_id,target_sub_strand_id,outcome_id,action,promoted_by,evidence)
    values(p_snapshot_id,r.observation_id,v_current_sub_strand_id,v_outcome_id,v_action,v_owner,
      jsonb_build_object('source_id',v_source.id,'artifact_id',v_artifact.id,'artifact_sha256',v_artifact.content_sha256,'snapshot_sha256',v_snapshot.snapshot_sha256,'source_locator',r.source_locator,'preserved_creator_claimed_history',true))
    on conflict(snapshot_id,observation_id) do nothing;
  end loop;
  update public.curriculum_authority_snapshots set status='promoted',promoted_at=now(),updated_at=now() where id=p_snapshot_id;
  return jsonb_build_object('success',true,'snapshot_id',p_snapshot_id,'inserted_official',v_inserted,'matched_existing_official',v_matched);
end $function$;
