begin;

-- P0: bind the existing Grade 10 Chemistry convergence mission to the canonical
-- curriculum_imports -> curriculum_learning_outcomes -> chapter links chain.
-- This migration is deliberately non-activating and does not seed, verify, publish,
-- schedule, or execute content. Human source review remains an owner action.
-- access: owner-only source sealing/verification; service-only mission execution.
-- authorization-test: anon cannot execute any function introduced here; source
-- verification requires hq_assert_owner; mission and publication paths fail closed.

alter table public.curriculum_imports
  add column if not exists content_sha256 text,
  add column if not exists effective_from date,
  add column if not exists supersedes_import_id uuid
    references public.curriculum_imports(id) on delete restrict;

alter table public.curriculum_imports
  drop constraint if exists curriculum_imports_content_sha256_check;
alter table public.curriculum_imports
  add constraint curriculum_imports_content_sha256_check
  check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$') not valid;
alter table public.curriculum_imports
  validate constraint curriculum_imports_content_sha256_check;

alter table public.curriculum_learning_outcomes
  add column if not exists source_import_id uuid
    references public.curriculum_imports(id) on delete restrict,
  add column if not exists source_locator text;

create index if not exists curriculum_learning_outcomes_source_import_idx
  on public.curriculum_learning_outcomes(source_import_id);

create or replace function public.curriculum_verified_source_immutable()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if old.status='verified' and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'VERIFIED_CURRICULUM_SOURCE_IMMUTABLE';
  end if;
  return new;
end $$;

drop trigger if exists curriculum_verified_source_immutable on public.curriculum_imports;
create trigger curriculum_verified_source_immutable
before update or delete on public.curriculum_imports
for each row execute function public.curriculum_verified_source_immutable();

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

drop trigger if exists curriculum_verified_outcome_immutable on public.curriculum_learning_outcomes;
create trigger curriculum_verified_outcome_immutable
before update or delete on public.curriculum_learning_outcomes
for each row execute function public.curriculum_verified_outcome_immutable();

create or replace function public.hq_seal_curriculum_import_source(
  p_import_id uuid,
  p_content_sha256 text,
  p_effective_from date default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v public.curriculum_imports%rowtype;
begin
  perform public.hq_assert_owner();
  if coalesce(p_content_sha256,'') !~ '^[0-9a-f]{64}$' then
    raise exception 'CURRICULUM_SOURCE_SHA256_REQUIRED';
  end if;
  select * into v from public.curriculum_imports where id=p_import_id for update;
  if not found then raise exception 'CURRICULUM_IMPORT_NOT_FOUND'; end if;
  if v.status<>'draft' then raise exception 'CURRICULUM_IMPORT_DRAFT_REQUIRED'; end if;
  if lower(v.source_type)<>'official'
     or lower(v.authority_name) not like '%kenya institute of curriculum development%'
     or nullif(btrim(coalesce(v.version_label,'')),'') is null
     or (nullif(btrim(coalesce(v.source_url,'')),'') is null
         and nullif(btrim(coalesce(v.source_ref,'')),'') is null) then
    raise exception 'OFFICIAL_VERSIONED_KICD_SOURCE_REQUIRED';
  end if;
  update public.curriculum_imports
     set content_sha256=lower(p_content_sha256),effective_from=p_effective_from,
         updated_at=clock_timestamp()
   where id=p_import_id;
  return jsonb_build_object('import_id',p_import_id,'content_sha256',lower(p_content_sha256),
    'effective_from',p_effective_from,'status','draft','verified',false);
end $$;

create or replace function public.hq_bind_curriculum_outcomes_to_import(
  p_import_id uuid,
  p_outcome_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v public.curriculum_imports%rowtype; v_count integer;
begin
  perform public.hq_assert_owner();
  select * into v from public.curriculum_imports where id=p_import_id for update;
  if not found then raise exception 'CURRICULUM_IMPORT_NOT_FOUND'; end if;
  if v.status<>'draft' or v.content_sha256 is null then
    raise exception 'SEALED_DRAFT_CURRICULUM_IMPORT_REQUIRED';
  end if;
  if coalesce(cardinality(p_outcome_ids),0)=0 then raise exception 'CURRICULUM_OUTCOMES_REQUIRED'; end if;
  if exists(
    select 1 from public.curriculum_learning_outcomes o
    left join public.curriculum c on c.id=o.curriculum_id
    where o.id=any(p_outcome_ids)
      and (o.status<>'draft' or o.source_type<>'official'
        or lower(coalesce(c.subject,''))<>lower(v.subject)
        or replace(lower(coalesce(c.grade,'')),' ','')<>replace(lower(v.grade),' ',''))
  ) then raise exception 'CURRICULUM_OUTCOME_IMPORT_SCOPE_MISMATCH'; end if;
  update public.curriculum_learning_outcomes
     set source_import_id=p_import_id,updated_at=clock_timestamp()
   where id=any(p_outcome_ids) and status='draft' and source_type='official';
  get diagnostics v_count=row_count;
  if v_count<>cardinality(p_outcome_ids) then raise exception 'CURRICULUM_OUTCOME_BINDING_INCOMPLETE'; end if;
  return jsonb_build_object('import_id',p_import_id,'bound_outcomes',v_count,'verified',false);
end $$;

create or replace function public.hq_review_curriculum_import(p_id uuid,p_status text)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v public.curriculum_imports%rowtype;
begin
  perform public.hq_assert_owner();
  if p_status not in ('reviewed','verified','rejected') then raise exception 'Invalid review status'; end if;
  select * into v from public.curriculum_imports where id=p_id for update;
  if not found then raise exception 'Curriculum import not found'; end if;
  if p_status='verified' then
    if lower(v.source_type)<>'official' or v.content_sha256 is null
       or nullif(btrim(coalesce(v.version_label,'')),'') is null
       or (nullif(btrim(coalesce(v.source_url,'')),'') is null
           and nullif(btrim(coalesce(v.source_ref,'')),'') is null) then
      raise exception 'SEALED_OFFICIAL_CURRICULUM_SOURCE_REQUIRED';
    end if;
    if not exists(select 1 from public.curriculum_learning_outcomes o
                  where o.source_import_id=p_id and o.status='draft' and o.source_type='official') then
      raise exception 'BOUND_OFFICIAL_CURRICULUM_OUTCOMES_REQUIRED';
    end if;
    if exists(select 1 from public.curriculum_learning_outcomes o
              where o.source_import_id=p_id
                and (nullif(btrim(coalesce(o.outcome_code,'')),'') is null
                  or nullif(btrim(coalesce(o.source_ref,'')),'') is null
                  or nullif(btrim(coalesce(o.source_locator,'')),'') is null)) then
      raise exception 'OUTCOME_CODE_AND_EXACT_SOURCE_LOCATION_REQUIRED';
    end if;
  end if;
  update public.curriculum_imports
     set status=p_status,
         verified_by=case when p_status='verified' then auth.uid() else verified_by end,
         verified_at=case when p_status='verified' then clock_timestamp() else verified_at end,
         updated_at=clock_timestamp()
   where id=p_id;
end $$;

create or replace function public.hq_verify_curriculum_outcomes(
  p_import_id uuid,
  p_outcome_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_count integer;
begin
  perform public.hq_assert_owner();
  if not exists(select 1 from public.curriculum_imports i
                where i.id=p_import_id and i.status='verified'
                  and i.source_type='official' and i.content_sha256 is not null) then
    raise exception 'VERIFIED_OFFICIAL_CURRICULUM_IMPORT_REQUIRED';
  end if;
  if coalesce(cardinality(p_outcome_ids),0)=0 then raise exception 'CURRICULUM_OUTCOMES_REQUIRED'; end if;
  if exists(select 1 from public.curriculum_learning_outcomes o
            where o.id=any(p_outcome_ids)
              and (o.source_import_id is distinct from p_import_id
                or o.status<>'draft' or o.source_type<>'official'
                or nullif(btrim(coalesce(o.outcome_code,'')),'') is null
                or nullif(btrim(coalesce(o.source_ref,'')),'') is null
                or nullif(btrim(coalesce(o.source_locator,'')),'') is null)) then
    raise exception 'CURRICULUM_OUTCOME_VERIFICATION_EVIDENCE_INCOMPLETE';
  end if;
  update public.curriculum_learning_outcomes
     set status='verified',verified_by=auth.uid(),verified_at=clock_timestamp(),
         updated_at=clock_timestamp()
   where id=any(p_outcome_ids) and source_import_id=p_import_id and status='draft';
  get diagnostics v_count=row_count;
  if v_count<>cardinality(p_outcome_ids) then raise exception 'CURRICULUM_OUTCOME_VERIFICATION_INCOMPLETE'; end if;
  return jsonb_build_object('import_id',p_import_id,'verified_outcomes',v_count);
end $$;

create or replace function public.chemistry_curriculum_authority_snapshot(
  p_publication_id uuid,
  p_fail_closed boolean default true
) returns jsonb
language plpgsql
security definer
stable
set search_path=public,pg_temp
as $$
declare
  p public.vibe_publications%rowtype; i public.curriculum_imports%rowtype;
  v_chapters integer; v_linked_chapters integer; v_outcomes integer;
  v_mapped_outcomes integer; v_invalid_links integer; v_digest text; v_result jsonb;
begin
  select * into p from public.vibe_publications where id=p_publication_id;
  if not found then raise exception 'CHEMISTRY_PUBLICATION_NOT_FOUND'; end if;
  if lower(coalesce(p.cbc_subject,''))<>'chemistry'
     or replace(lower(coalesce(p.cbc_grade,'')),' ','') not in ('grade10','10') then
    raise exception 'GRADE10_CHEMISTRY_PUBLICATION_REQUIRED';
  end if;
  select * into i from public.curriculum_imports x
   where x.status='verified' and x.source_type='official'
     and lower(x.authority_name) like '%kenya institute of curriculum development%'
     and lower(x.subject)='chemistry'
     and replace(lower(x.grade),' ','') in ('grade10','10')
     and x.content_sha256 is not null and nullif(btrim(coalesce(x.version_label,'')),'') is not null
   order by x.verified_at desc,x.id desc limit 1;

  select count(*) into v_chapters from public.vibe_chapters c where c.publication_id=p.id;
  select count(distinct c.id) into v_linked_chapters
    from public.vibe_chapters c
    join public.chapter_learning_outcome_links l on l.chapter_id=c.id and l.publication_id=p.id
    join public.curriculum_learning_outcomes o on o.id=l.outcome_id
   where c.publication_id=p.id and c.curriculum_id is not null
     and i.id is not null and o.source_import_id=i.id
     and o.status='verified' and o.source_type='official';
  select count(*) into v_outcomes from public.curriculum_learning_outcomes o
   where i.id is not null and o.source_import_id=i.id and o.status='verified' and o.source_type='official';
  select count(distinct l.outcome_id) into v_mapped_outcomes
    from public.chapter_learning_outcome_links l
    join public.vibe_chapters c on c.id=l.chapter_id and c.publication_id=p.id
    join public.curriculum_learning_outcomes o on o.id=l.outcome_id
   where i.id is not null and o.source_import_id=i.id and o.status='verified' and o.source_type='official';
  select count(*) into v_invalid_links
    from public.chapter_learning_outcome_links l
    join public.vibe_chapters c on c.id=l.chapter_id and c.publication_id=p.id
    join public.curriculum_learning_outcomes o on o.id=l.outcome_id
   where i.id is null or o.source_import_id is distinct from i.id
      or o.status<>'verified' or o.source_type<>'official';

  if i.id is not null then
    v_digest:=pg_catalog.encode(extensions.digest(jsonb_build_object(
      'import_id',i.id,'source_hash',i.content_sha256,'version',i.version_label,
      'outcomes',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'code',o.outcome_code,
        'text',o.outcome_text,'source_ref',o.source_ref,'source_locator',o.source_locator) order by o.outcome_code,o.id)
        from public.curriculum_learning_outcomes o where o.source_import_id=i.id and o.status='verified'),'[]'::jsonb),
      'chapter_links',coalesce((select jsonb_agg(jsonb_build_object('chapter_id',l.chapter_id,'outcome_id',l.outcome_id,'strength',l.alignment_strength) order by l.chapter_id,l.sequence,l.outcome_id)
        from public.chapter_learning_outcome_links l join public.vibe_chapters c on c.id=l.chapter_id
        where c.publication_id=p.id),'[]'::jsonb))::text,'sha256'),'hex');
  end if;
  v_result:=jsonb_build_object(
    'publication_id',p.id,'curriculum_import_id',i.id,'curriculum_version',i.version_label,
    'curriculum_source_sha256',i.content_sha256,'authority_lock_sha256',v_digest,
    'chapters',v_chapters,'authoritatively_linked_chapters',v_linked_chapters,
    'verified_official_outcomes',v_outcomes,'mapped_verified_outcomes',v_mapped_outcomes,
    'invalid_or_unverified_links',v_invalid_links,
    'complete',i.id is not null and v_chapters>0 and v_linked_chapters=v_chapters
      and v_outcomes>0 and v_mapped_outcomes=v_outcomes and v_invalid_links=0);
  if p_fail_closed and not coalesce((v_result->>'complete')::boolean,false) then
    raise exception 'CHEMISTRY_CURRICULUM_AUTHORITY_INCOMPLETE:%',v_result::text;
  end if;
  return v_result;
end $$;

create or replace function public.chemistry_require_curriculum_before_mission()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.state in ('READY','RUNNING','WAITING_HUMAN_REVIEW','COMPLETED') then
    perform public.chemistry_curriculum_authority_snapshot(new.publication_id,true);
  end if;
  return new;
end $$;

drop trigger if exists chemistry_require_curriculum_before_mission on public.chemistry_worker_missions;
create trigger chemistry_require_curriculum_before_mission
before insert or update of state,publication_id on public.chemistry_worker_missions
for each row execute function public.chemistry_require_curriculum_before_mission();

create or replace function public.chemistry_bind_curriculum_authority_to_attempt()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_publication_id uuid; v_snapshot jsonb;
begin
  select m.publication_id into v_publication_id
    from public.chemistry_worker_mission_items i
    join public.chemistry_worker_missions m on m.id=i.mission_id
   where i.id=new.item_id;
  v_snapshot:=public.chemistry_curriculum_authority_snapshot(v_publication_id,true);
  new.input_packet:=coalesce(new.input_packet,'{}'::jsonb)
    ||jsonb_build_object('curriculum_authority',v_snapshot);
  return new;
end $$;

drop trigger if exists chemistry_bind_curriculum_authority_to_attempt on public.chemistry_worker_stage_attempts;
create trigger chemistry_bind_curriculum_authority_to_attempt
before insert on public.chemistry_worker_stage_attempts
for each row execute function public.chemistry_bind_curriculum_authority_to_attempt();

create or replace function public.chemistry_require_curriculum_before_publication()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.status='published' and old.status is distinct from 'published'
     and lower(coalesce(new.cbc_subject,''))='chemistry'
     and replace(lower(coalesce(new.cbc_grade,'')),' ','') in ('grade10','10') then
    perform public.chemistry_curriculum_authority_snapshot(new.id,true);
  end if;
  return new;
end $$;

drop trigger if exists chemistry_require_curriculum_before_publication on public.vibe_publications;
create trigger chemistry_require_curriculum_before_publication
before update of status on public.vibe_publications
for each row execute function public.chemistry_require_curriculum_before_publication();

revoke all on function public.hq_seal_curriculum_import_source(uuid,text,date),
  public.hq_bind_curriculum_outcomes_to_import(uuid,uuid[]),
  public.hq_verify_curriculum_outcomes(uuid,uuid[]),
  public.chemistry_curriculum_authority_snapshot(uuid,boolean)
  from public,anon,authenticated,service_role;
revoke all on function public.hq_review_curriculum_import(uuid,text) from public,anon,service_role;
grant execute on function public.hq_seal_curriculum_import_source(uuid,text,date),
  public.hq_bind_curriculum_outcomes_to_import(uuid,uuid[]),
  public.hq_verify_curriculum_outcomes(uuid,uuid[]),
  public.hq_review_curriculum_import(uuid,text) to authenticated;
grant execute on function public.chemistry_curriculum_authority_snapshot(uuid,boolean) to service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CHEMISTRY_CURRICULUM_AUTHORITY_NON_ACTIVATING_BOUNDARY_VIOLATED';
  end if;
  if has_function_privilege('anon','public.hq_seal_curriculum_import_source(uuid,text,date)','EXECUTE')
     or has_function_privilege('service_role','public.hq_seal_curriculum_import_source(uuid,text,date)','EXECUTE')
     or has_function_privilege('anon','public.hq_verify_curriculum_outcomes(uuid,uuid[])','EXECUTE') then
    raise exception 'CHEMISTRY_CURRICULUM_HUMAN_AUTHORITY_EXPOSED';
  end if;
end $$;

commit;
