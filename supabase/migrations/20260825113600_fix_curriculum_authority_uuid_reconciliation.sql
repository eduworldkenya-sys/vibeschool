-- Repair PostgreSQL UUID hierarchy selection in Curriculum Authority reconciliation.
-- PostgreSQL does not provide min(uuid); use deterministic ordered array aggregation.

create or replace function public.curriculum_authority_reconcile_snapshot(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_snapshot public.curriculum_authority_snapshots%rowtype;
  v_source public.curriculum_authority_sources%rowtype;
  v_count integer;
  v_hash text;
  o record;
  v_hierarchy_count integer;
  v_sub_strand_id uuid;
  v_official_exact uuid;
  v_official_code_conflict uuid;
  v_creator_exact uuid;
  v_classification text;
  v_counts jsonb := '{}'::jsonb;
begin
  select * into v_snapshot from public.curriculum_authority_snapshots where id=p_snapshot_id for update;
  if not found then raise exception 'snapshot_not_found'; end if;
  if v_snapshot.status<>'sealed' then raise exception 'snapshot_not_sealed'; end if;

  select * into v_source from public.curriculum_authority_sources where id=v_snapshot.source_id;
  if not found or v_source.source_status<>'approved' then raise exception 'source_not_approved'; end if;

  select count(*)::integer,
    encode(extensions.digest(convert_to(coalesce(string_agg(row_sha256,'|' order by observation_key),''),'UTF8'),'sha256'),'hex')
  into v_count,v_hash
  from public.curriculum_authority_observations where snapshot_id=p_snapshot_id;
  if v_count is distinct from v_snapshot.observation_count then raise exception 'sealed_snapshot_count_mismatch'; end if;
  if v_hash is distinct from v_snapshot.snapshot_sha256 then raise exception 'sealed_snapshot_checksum_mismatch'; end if;

  delete from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id;
  for o in select * from public.curriculum_authority_observations where snapshot_id=p_snapshot_id order by observation_key loop
    v_hierarchy_count:=0; v_sub_strand_id:=null; v_official_exact:=null;
    v_official_code_conflict:=null; v_creator_exact:=null;

    if public.curriculum_authority_normalize_text(o.curriculum_framework)<>public.curriculum_authority_normalize_text(v_source.curriculum_framework)
      or public.curriculum_authority_normalize_text(o.grade)<>public.curriculum_authority_normalize_text(v_source.grade)
      or public.curriculum_authority_normalize_text(o.subject_label)<>public.curriculum_authority_normalize_text(v_source.subject_label)
    then
      v_classification:='scope_mismatch';
    else
      select count(*)::integer,(array_agg(cs.id order by cs.id))[1]
      into v_hierarchy_count,v_sub_strand_id
      from public.cbc_strands cs
      where cs.subject_id=v_source.canonical_subject_id
        and public.curriculum_authority_normalize_text(cs.grade)=public.curriculum_authority_normalize_text(v_source.grade)
        and public.curriculum_authority_normalize_text(cs.name)=public.curriculum_authority_normalize_text(o.strand)
        and public.curriculum_authority_normalize_text(coalesce(cs.sub_strand,''))=public.curriculum_authority_normalize_text(o.sub_strand)
        and cs.term is null and cs.week is null;

      if v_hierarchy_count=0 then
        v_classification:='missing_hierarchy';
      elsif v_hierarchy_count>1 then
        v_classification:='official_conflict'; v_sub_strand_id:=null;
      else
        select clo.id into v_official_code_conflict
        from public.curriculum_learning_outcomes clo
        where clo.sub_strand_id=v_sub_strand_id and clo.source_type='official' and clo.status in ('active','verified')
          and nullif(public.curriculum_authority_normalize_text(o.outcome_code),'') is not null
          and public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code)
          and public.curriculum_authority_normalize_text(clo.outcome_text)<>public.curriculum_authority_normalize_text(o.outcome_text)
        order by clo.id limit 1;

        if v_official_code_conflict is not null then
          v_classification:='official_conflict';
        else
          select clo.id into v_official_exact
          from public.curriculum_learning_outcomes clo
          where clo.sub_strand_id=v_sub_strand_id and clo.source_type='official' and clo.status in ('active','verified')
            and public.curriculum_authority_normalize_text(clo.outcome_text)=public.curriculum_authority_normalize_text(o.outcome_text)
            and (nullif(public.curriculum_authority_normalize_text(o.outcome_code),'') is null
              or public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code))
          order by clo.id limit 1;

          if v_official_exact is not null then
            v_classification:='exact_official';
          else
            select clo.id into v_creator_exact
            from public.curriculum_learning_outcomes clo
            where clo.sub_strand_id=v_sub_strand_id and clo.source_type='creator_claimed' and clo.status in ('draft','active','verified')
              and public.curriculum_authority_normalize_text(clo.outcome_text)=public.curriculum_authority_normalize_text(o.outcome_text)
              and (nullif(public.curriculum_authority_normalize_text(o.outcome_code),'') is null
                or public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code))
            order by clo.id limit 1;
            if v_creator_exact is not null then v_classification:='creator_claimed_replacement_candidate';
            else v_classification:='missing_outcome'; end if;
          end if;
        end if;
      end if;
    end if;

    insert into public.curriculum_authority_reconciliation(
      snapshot_id,observation_id,classification,target_sub_strand_id,target_outcome_id,details
    ) values (
      p_snapshot_id,o.id,v_classification,v_sub_strand_id,
      coalesce(v_official_exact,v_official_code_conflict,v_creator_exact),
      jsonb_build_object('canonical_subject_id',v_source.canonical_subject_id,'hierarchy_match_count',coalesce(v_hierarchy_count,0),
        'official_code_conflict_id',v_official_code_conflict,'creator_claimed_candidate_id',v_creator_exact)
    );
    v_counts:=jsonb_set(v_counts,array[v_classification],to_jsonb(coalesce((v_counts->>v_classification)::integer,0)+1),true);
  end loop;

  update public.curriculum_authority_snapshots
  set status='reconciled',reconciled_at=now(),updated_at=now()
  where id=p_snapshot_id;
  return jsonb_build_object('snapshot_id',p_snapshot_id,'classifications',v_counts);
end
$function$;
