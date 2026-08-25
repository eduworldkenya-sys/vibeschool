begin;

-- Repair PostgreSQL UUID selection in the owner-gated hierarchy binder.
-- PostgreSQL has no built-in min(uuid); ordered array aggregation selects the
-- deterministic UUID while preserving duplicate detection and all authority,
-- checksum, provenance, reconciliation, and non-pacing boundaries.

create or replace function public.curriculum_authority_bind_hierarchy(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid:=auth.uid();
  v_snapshot public.curriculum_authority_snapshots%rowtype;
  v_source public.curriculum_authority_sources%rowtype;
  v_artifact public.curriculum_authority_artifacts%rowtype;
  v_count integer;
  v_hash text;
  r record;
  v_match_count integer;
  v_sub_strand_id uuid;
  v_hierarchy_sha text;
  v_action text;
  v_inserted integer:=0;
  v_reused integer:=0;
  v_new_bindings integer:=0;
begin
  perform public.hq_assert_owner();
  if v_owner is null then raise exception 'authentication_required'; end if;

  select * into v_snapshot from public.curriculum_authority_snapshots where id=p_snapshot_id for update;
  if not found then raise exception 'snapshot_not_found'; end if;
  if v_snapshot.status<>'reconciled' then raise exception 'snapshot_not_reconciled'; end if;

  select * into v_source from public.curriculum_authority_sources where id=v_snapshot.source_id;
  select * into v_artifact from public.curriculum_authority_artifacts where id=v_snapshot.artifact_id;
  if not found or v_source.source_status<>'approved' then raise exception 'source_not_approved'; end if;
  if v_artifact.source_id<>v_source.id then raise exception 'artifact_source_mismatch'; end if;

  select count(*)::integer,
    encode(extensions.digest(convert_to(coalesce(string_agg(row_sha256,'|' order by observation_key),''),'UTF8'),'sha256'),'hex')
  into v_count,v_hash
  from public.curriculum_authority_observations
  where snapshot_id=p_snapshot_id;

  if v_count is distinct from v_snapshot.observation_count then raise exception 'sealed_snapshot_count_mismatch'; end if;
  if v_hash is distinct from v_snapshot.snapshot_sha256 then raise exception 'sealed_snapshot_checksum_mismatch'; end if;
  if (select count(*) from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id)<>v_snapshot.observation_count then raise exception 'snapshot_reconciliation_incomplete'; end if;
  if exists(select 1 from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id and classification in ('official_conflict','scope_mismatch')) then raise exception 'snapshot_has_unresolved_conflicts'; end if;

  for r in
    select distinct o.curriculum_framework,o.grade,o.subject_label,o.strand,o.sub_strand
    from public.curriculum_authority_reconciliation rr
    join public.curriculum_authority_observations o on o.id=rr.observation_id
    where rr.snapshot_id=p_snapshot_id
    order by o.strand,o.sub_strand
  loop
    if public.curriculum_authority_normalize_text(r.curriculum_framework)<>public.curriculum_authority_normalize_text(v_source.curriculum_framework)
      or public.curriculum_authority_normalize_text(r.grade)<>public.curriculum_authority_normalize_text(v_source.grade)
      or public.curriculum_authority_normalize_text(r.subject_label)<>public.curriculum_authority_normalize_text(v_source.subject_label)
    then raise exception 'hierarchy_scope_mismatch'; end if;

    v_hierarchy_sha:=encode(extensions.digest(convert_to(jsonb_build_object('canonical_subject_id',v_source.canonical_subject_id,'grade',public.curriculum_authority_normalize_text(v_source.grade),'strand',public.curriculum_authority_normalize_text(r.strand),'sub_strand',public.curriculum_authority_normalize_text(r.sub_strand))::text,'UTF8'),'sha256'),'hex');

    if exists(select 1 from public.curriculum_authority_hierarchy_bindings where snapshot_id=p_snapshot_id and hierarchy_sha256=v_hierarchy_sha) then continue; end if;

    select count(*)::integer,(array_agg(cs.id order by cs.id))[1]
    into v_match_count,v_sub_strand_id
    from public.cbc_strands cs
    where cs.subject_id=v_source.canonical_subject_id
      and public.curriculum_authority_normalize_text(cs.grade)=public.curriculum_authority_normalize_text(v_source.grade)
      and public.curriculum_authority_normalize_text(cs.name)=public.curriculum_authority_normalize_text(r.strand)
      and public.curriculum_authority_normalize_text(coalesce(cs.sub_strand,''))=public.curriculum_authority_normalize_text(r.sub_strand)
      and cs.term is null and cs.week is null;

    if v_match_count>1 then raise exception 'ambiguous_unpaced_cbc_hierarchy'; end if;
    if v_match_count=0 then
      insert into public.cbc_strands(subject_id,grade,name,sub_strand,term,week,source_ref)
      values(v_source.canonical_subject_id,v_source.grade,r.strand,r.sub_strand,null,null,v_artifact.source_url)
      returning id into v_sub_strand_id;
      v_action:='inserted_source_hierarchy'; v_inserted:=v_inserted+1;
    else
      v_action:='reused_source_hierarchy'; v_reused:=v_reused+1;
    end if;

    insert into public.curriculum_authority_hierarchy_bindings(snapshot_id,source_id,artifact_id,sub_strand_id,hierarchy_sha256,canonical_subject_id,grade,strand,sub_strand,action,source_ref,snapshot_sha256,artifact_sha256,bound_by,evidence)
    values(p_snapshot_id,v_source.id,v_artifact.id,v_sub_strand_id,v_hierarchy_sha,v_source.canonical_subject_id,v_source.grade,r.strand,r.sub_strand,v_action,v_artifact.source_url,v_snapshot.snapshot_sha256,v_artifact.content_sha256,v_owner,jsonb_build_object('pacing_authority',false,'term',null,'week',null,'source_version',v_artifact.source_version));
    v_new_bindings:=v_new_bindings+1;
  end loop;

  if v_new_bindings>0 then
    delete from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id;
    update public.curriculum_authority_snapshots set status='sealed',reconciled_at=null,updated_at=now() where id=p_snapshot_id;
  end if;

  return jsonb_build_object('success',true,'snapshot_id',p_snapshot_id,'inserted',v_inserted,'reused',v_reused,'new_bindings',v_new_bindings,'requires_fresh_reconciliation',v_new_bindings>0);
end
$function$;

revoke all on function public.curriculum_authority_bind_hierarchy(uuid) from public,anon;
grant execute on function public.curriculum_authority_bind_hierarchy(uuid) to authenticated;
comment on function public.curriculum_authority_bind_hierarchy(uuid) is 'Owner-gated exact, unpaced curriculum hierarchy binding with deterministic UUID selection.';
commit;
