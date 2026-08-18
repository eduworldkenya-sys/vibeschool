begin;

-- Authoritative curriculum source ingestion, reconciliation and promotion v1.
--
-- National curriculum content authority is deliberately separated from school pacing.
-- public.cbc_strands is the existing unpaced CBC hierarchy surface.
-- public.curriculum remains an operational/pacing surface and is never populated here.

create or replace function public.curriculum_authority_normalize_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_text,'')), '\s+', ' ', 'g'))
$$;

revoke all on function public.curriculum_authority_normalize_text(text) from public,anon,authenticated;
grant execute on function public.curriculum_authority_normalize_text(text) to service_role;

create table if not exists public.curriculum_authority_sources (
  id uuid primary key default gen_random_uuid(),
  authority_name text not null,
  curriculum_framework text not null,
  grade text not null,
  canonical_subject_id uuid not null references public.subjects(id) on delete restrict,
  subject_label text not null,
  source_url text not null,
  source_version text not null default '',
  source_published_on date,
  source_status text not null default 'approved',
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_authority_sources_status_check
    check (source_status in ('approved','revoked')),
  constraint curriculum_authority_sources_identity_key
    unique(authority_name,curriculum_framework,grade,canonical_subject_id,source_url,source_version)
);

create table if not exists public.curriculum_authority_artifacts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.curriculum_authority_sources(id) on delete restrict,
  source_url text not null,
  source_version text not null default '',
  source_published_on date,
  retrieved_at timestamptz not null default now(),
  content_sha256 text not null,
  storage_locator text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint curriculum_authority_artifacts_hash_check
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint curriculum_authority_artifacts_source_hash_key unique(source_id,content_sha256)
);

create table if not exists public.curriculum_authority_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.curriculum_authority_sources(id) on delete restrict,
  artifact_id uuid not null references public.curriculum_authority_artifacts(id) on delete restrict,
  status text not null default 'staging',
  observation_count integer,
  snapshot_sha256 text,
  sealed_at timestamptz,
  reconciled_at timestamptz,
  promoted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_authority_snapshots_status_check
    check (status in ('staging','sealed','reconciled','promoted','rejected')),
  constraint curriculum_authority_snapshots_hash_check
    check (snapshot_sha256 is null or snapshot_sha256 ~ '^[0-9a-f]{64}$')
);

create table if not exists public.curriculum_authority_observations (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.curriculum_authority_snapshots(id) on delete restrict,
  observation_key text not null,
  curriculum_framework text not null,
  grade text not null,
  subject_label text not null,
  strand text not null,
  sub_strand text not null,
  topic text,
  outcome_text text not null,
  outcome_code text,
  outcome_ordinal integer,
  difficulty text,
  competencies jsonb not null default '[]'::jsonb,
  values_payload jsonb not null default '[]'::jsonb,
  key_inquiry_questions jsonb not null default '[]'::jsonb,
  suggested_experiences jsonb not null default '[]'::jsonb,
  assessment_guidance jsonb not null default '[]'::jsonb,
  source_locator text,
  source_page text,
  source_section text,
  raw_payload jsonb not null default '{}'::jsonb,
  row_sha256 text not null,
  created_at timestamptz not null default now(),
  constraint curriculum_authority_observations_key unique(snapshot_id,observation_key),
  constraint curriculum_authority_observations_hash_check
    check (row_sha256 ~ '^[0-9a-f]{64}$'),
  constraint curriculum_authority_observations_nonempty_check
    check (
      btrim(observation_key)<>'' and btrim(strand)<>'' and
      btrim(sub_strand)<>'' and btrim(outcome_text)<>''
    )
);

create table if not exists public.curriculum_authority_reconciliation (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.curriculum_authority_snapshots(id) on delete cascade,
  observation_id uuid not null references public.curriculum_authority_observations(id) on delete restrict,
  classification text not null,
  target_sub_strand_id uuid references public.cbc_strands(id) on delete restrict,
  target_outcome_id uuid references public.curriculum_learning_outcomes(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  reconciled_at timestamptz not null default now(),
  unique(snapshot_id,observation_id),
  constraint curriculum_authority_reconciliation_classification_check
    check (classification in (
      'exact_official',
      'missing_hierarchy',
      'missing_outcome',
      'creator_claimed_replacement_candidate',
      'official_conflict',
      'scope_mismatch'
    ))
);

create table if not exists public.curriculum_authority_promotions (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.curriculum_authority_snapshots(id) on delete restrict,
  observation_id uuid not null references public.curriculum_authority_observations(id) on delete restrict,
  target_sub_strand_id uuid not null references public.cbc_strands(id) on delete restrict,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete restrict,
  action text not null,
  promoted_by uuid not null references auth.users(id) on delete restrict,
  promoted_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  unique(snapshot_id,observation_id),
  constraint curriculum_authority_promotions_action_check
    check (action in ('matched_existing_official','inserted_official'))
);

create index if not exists curriculum_authority_observations_snapshot_idx
  on public.curriculum_authority_observations(snapshot_id,observation_key);
create index if not exists curriculum_authority_reconciliation_snapshot_idx
  on public.curriculum_authority_reconciliation(snapshot_id,classification);
create index if not exists curriculum_authority_promotions_outcome_idx
  on public.curriculum_authority_promotions(outcome_id,promoted_at);

alter table public.curriculum_authority_sources enable row level security;
alter table public.curriculum_authority_artifacts enable row level security;
alter table public.curriculum_authority_snapshots enable row level security;
alter table public.curriculum_authority_observations enable row level security;
alter table public.curriculum_authority_reconciliation enable row level security;
alter table public.curriculum_authority_promotions enable row level security;

revoke all on table public.curriculum_authority_sources from public,anon,authenticated;
revoke all on table public.curriculum_authority_artifacts from public,anon,authenticated;
revoke all on table public.curriculum_authority_snapshots from public,anon,authenticated;
revoke all on table public.curriculum_authority_observations from public,anon,authenticated;
revoke all on table public.curriculum_authority_reconciliation from public,anon,authenticated;
revoke all on table public.curriculum_authority_promotions from public,anon,authenticated;

grant all on table public.curriculum_authority_sources to service_role;
grant all on table public.curriculum_authority_artifacts to service_role;
grant all on table public.curriculum_authority_snapshots to service_role;
grant all on table public.curriculum_authority_observations to service_role;
grant all on table public.curriculum_authority_reconciliation to service_role;
grant all on table public.curriculum_authority_promotions to service_role;

create or replace function public.curriculum_authority_guard_source_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.curriculum_authority_artifacts a where a.source_id=old.id
  ) and (
    new.authority_name is distinct from old.authority_name or
    new.curriculum_framework is distinct from old.curriculum_framework or
    new.grade is distinct from old.grade or
    new.canonical_subject_id is distinct from old.canonical_subject_id or
    new.subject_label is distinct from old.subject_label or
    new.source_url is distinct from old.source_url or
    new.source_version is distinct from old.source_version
  ) then
    raise exception 'curriculum_authority_source_identity_immutable';
  end if;
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists curriculum_authority_guard_source_identity_trigger
  on public.curriculum_authority_sources;
create trigger curriculum_authority_guard_source_identity_trigger
before update on public.curriculum_authority_sources
for each row execute function public.curriculum_authority_guard_source_identity();

create or replace function public.curriculum_authority_artifact_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'curriculum_authority_artifact_immutable';
end
$$;

drop trigger if exists curriculum_authority_artifact_immutable_trigger
  on public.curriculum_authority_artifacts;
create trigger curriculum_authority_artifact_immutable_trigger
before update or delete on public.curriculum_authority_artifacts
for each row execute function public.curriculum_authority_artifact_immutable();

create or replace function public.curriculum_authority_observation_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_status text;
begin
  select status into v_status
  from public.curriculum_authority_snapshots
  where id=coalesce(new.snapshot_id,old.snapshot_id);
  if v_status is distinct from 'staging' then
    raise exception 'curriculum_authority_observation_snapshot_sealed';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists curriculum_authority_observation_guard_trigger
  on public.curriculum_authority_observations;
create trigger curriculum_authority_observation_guard_trigger
before update or delete on public.curriculum_authority_observations
for each row execute function public.curriculum_authority_observation_guard();

create or replace function public.curriculum_authority_snapshot_identity_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.curriculum_authority_observations o where o.snapshot_id=old.id
  ) and (
    new.source_id is distinct from old.source_id or
    new.artifact_id is distinct from old.artifact_id
  ) then
    raise exception 'curriculum_authority_snapshot_identity_immutable';
  end if;
  return new;
end
$$;

drop trigger if exists curriculum_authority_snapshot_identity_guard_trigger
  on public.curriculum_authority_snapshots;
create trigger curriculum_authority_snapshot_identity_guard_trigger
before update on public.curriculum_authority_snapshots
for each row execute function public.curriculum_authority_snapshot_identity_guard();

create or replace function public.curriculum_authority_register_source(
  p_authority_name text,
  p_curriculum_framework text,
  p_grade text,
  p_canonical_subject_id uuid,
  p_source_url text,
  p_source_version text default '',
  p_source_published_on date default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_subject public.subjects%rowtype;
  v_id uuid;
begin
  perform public.hq_assert_owner();
  if v_owner is null then raise exception 'authentication_required'; end if;
  if nullif(btrim(p_authority_name),'') is null
     or nullif(btrim(p_curriculum_framework),'') is null
     or nullif(btrim(p_grade),'') is null
     or nullif(btrim(p_source_url),'') is null then
    raise exception 'invalid_source_identity';
  end if;

  select * into v_subject from public.subjects
  where id=p_canonical_subject_id;
  if not found or v_subject.school_id is not null then
    raise exception 'canonical_global_subject_required';
  end if;

  insert into public.curriculum_authority_sources(
    authority_name,curriculum_framework,grade,canonical_subject_id,subject_label,
    source_url,source_version,source_published_on,source_status,approved_by,metadata
  ) values (
    btrim(p_authority_name),btrim(p_curriculum_framework),btrim(p_grade),
    p_canonical_subject_id,v_subject.name,btrim(p_source_url),
    coalesce(btrim(p_source_version),''),p_source_published_on,'approved',v_owner,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (authority_name,curriculum_framework,grade,canonical_subject_id,source_url,source_version)
  do update set
    source_status='approved',
    source_published_on=coalesce(excluded.source_published_on,public.curriculum_authority_sources.source_published_on),
    metadata=public.curriculum_authority_sources.metadata || excluded.metadata,
    approved_by=excluded.approved_by,
    approved_at=now()
  returning id into v_id;

  return v_id;
end
$$;

create or replace function public.curriculum_authority_register_artifact(
  p_source_id uuid,
  p_source_url text,
  p_source_version text,
  p_source_published_on date,
  p_content_sha256 text,
  p_storage_locator text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_source public.curriculum_authority_sources%rowtype; v_id uuid;
begin
  select * into v_source from public.curriculum_authority_sources where id=p_source_id;
  if not found then raise exception 'source_not_found'; end if;
  if v_source.source_status<>'approved' then raise exception 'source_not_approved'; end if;
  if p_content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_artifact_sha256'; end if;
  if public.curriculum_authority_normalize_text(p_source_url)
     <> public.curriculum_authority_normalize_text(v_source.source_url) then
    raise exception 'artifact_source_url_mismatch';
  end if;
  if coalesce(btrim(p_source_version),'') <> coalesce(btrim(v_source.source_version),'') then
    raise exception 'artifact_source_version_mismatch';
  end if;

  insert into public.curriculum_authority_artifacts(
    source_id,source_url,source_version,source_published_on,content_sha256,storage_locator,metadata
  ) values (
    p_source_id,btrim(p_source_url),coalesce(btrim(p_source_version),''),
    p_source_published_on,p_content_sha256,nullif(btrim(p_storage_locator),''),
    coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (source_id,content_sha256) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.curriculum_authority_artifacts
    where source_id=p_source_id and content_sha256=p_content_sha256;
  end if;
  return v_id;
end
$$;

create or replace function public.curriculum_authority_create_snapshot(
  p_source_id uuid,
  p_artifact_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.curriculum_authority_artifacts
    where id=p_artifact_id and source_id=p_source_id
  ) then raise exception 'artifact_source_mismatch'; end if;

  insert into public.curriculum_authority_snapshots(source_id,artifact_id)
  values(p_source_id,p_artifact_id)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.curriculum_authority_add_observation(
  p_snapshot_id uuid,
  p_observation_key text,
  p_curriculum_framework text,
  p_grade text,
  p_subject_label text,
  p_strand text,
  p_sub_strand text,
  p_topic text,
  p_outcome_text text,
  p_outcome_code text default null,
  p_outcome_ordinal integer default null,
  p_difficulty text default null,
  p_competencies jsonb default '[]'::jsonb,
  p_values jsonb default '[]'::jsonb,
  p_key_inquiry_questions jsonb default '[]'::jsonb,
  p_suggested_experiences jsonb default '[]'::jsonb,
  p_assessment_guidance jsonb default '[]'::jsonb,
  p_source_locator text default null,
  p_source_page text default null,
  p_source_section text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_hash text;
  v_id uuid;
begin
  select status into v_status from public.curriculum_authority_snapshots where id=p_snapshot_id;
  if not found then raise exception 'snapshot_not_found'; end if;
  if v_status<>'staging' then raise exception 'snapshot_not_staging'; end if;
  if nullif(btrim(p_observation_key),'') is null
     or nullif(btrim(p_strand),'') is null
     or nullif(btrim(p_sub_strand),'') is null
     or nullif(btrim(p_outcome_text),'') is null then
    raise exception 'invalid_observation';
  end if;

  v_hash := encode(extensions.digest(convert_to(
    jsonb_build_object(
      'observation_key',btrim(p_observation_key),
      'curriculum_framework',btrim(p_curriculum_framework),
      'grade',btrim(p_grade),
      'subject_label',btrim(p_subject_label),
      'strand',btrim(p_strand),
      'sub_strand',btrim(p_sub_strand),
      'topic',nullif(btrim(p_topic),''),
      'outcome_text',btrim(p_outcome_text),
      'outcome_code',nullif(btrim(p_outcome_code),''),
      'outcome_ordinal',p_outcome_ordinal,
      'difficulty',nullif(btrim(p_difficulty),''),
      'competencies',coalesce(p_competencies,'[]'::jsonb),
      'values',coalesce(p_values,'[]'::jsonb),
      'key_inquiry_questions',coalesce(p_key_inquiry_questions,'[]'::jsonb),
      'suggested_experiences',coalesce(p_suggested_experiences,'[]'::jsonb),
      'assessment_guidance',coalesce(p_assessment_guidance,'[]'::jsonb),
      'source_locator',nullif(btrim(p_source_locator),''),
      'source_page',nullif(btrim(p_source_page),''),
      'source_section',nullif(btrim(p_source_section),''),
      'raw_payload',coalesce(p_raw_payload,'{}'::jsonb)
    )::text,'UTF8'),'sha256'),'hex');

  insert into public.curriculum_authority_observations(
    snapshot_id,observation_key,curriculum_framework,grade,subject_label,strand,sub_strand,topic,
    outcome_text,outcome_code,outcome_ordinal,difficulty,competencies,values_payload,key_inquiry_questions,
    suggested_experiences,assessment_guidance,source_locator,source_page,source_section,raw_payload,row_sha256
  ) values (
    p_snapshot_id,btrim(p_observation_key),btrim(p_curriculum_framework),btrim(p_grade),btrim(p_subject_label),
    btrim(p_strand),btrim(p_sub_strand),nullif(btrim(p_topic),''),
    btrim(p_outcome_text),nullif(btrim(p_outcome_code),''),p_outcome_ordinal,nullif(btrim(p_difficulty),''),
    coalesce(p_competencies,'[]'::jsonb),coalesce(p_values,'[]'::jsonb),
    coalesce(p_key_inquiry_questions,'[]'::jsonb),coalesce(p_suggested_experiences,'[]'::jsonb),
    coalesce(p_assessment_guidance,'[]'::jsonb),nullif(btrim(p_source_locator),''),
    nullif(btrim(p_source_page),''),nullif(btrim(p_source_section),''),
    coalesce(p_raw_payload,'{}'::jsonb),v_hash
  )
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.curriculum_authority_seal_snapshot(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_snapshot public.curriculum_authority_snapshots%rowtype; v_count integer; v_hash text;
begin
  select * into v_snapshot from public.curriculum_authority_snapshots
  where id=p_snapshot_id for update;
  if not found then raise exception 'snapshot_not_found'; end if;
  if v_snapshot.status<>'staging' then raise exception 'snapshot_not_staging'; end if;

  select count(*)::integer,
         encode(extensions.digest(convert_to(coalesce(string_agg(row_sha256,'|' order by observation_key),''),'UTF8'),'sha256'),'hex')
  into v_count,v_hash
  from public.curriculum_authority_observations
  where snapshot_id=p_snapshot_id;

  if v_count=0 then raise exception 'snapshot_has_no_observations'; end if;

  update public.curriculum_authority_snapshots
  set status='sealed',observation_count=v_count,snapshot_sha256=v_hash,sealed_at=now(),updated_at=now()
  where id=p_snapshot_id;

  return jsonb_build_object('snapshot_id',p_snapshot_id,'observation_count',v_count,'snapshot_sha256',v_hash);
end
$$;

create or replace function public.curriculum_authority_reconcile_snapshot(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  select * into v_snapshot from public.curriculum_authority_snapshots
  where id=p_snapshot_id for update;
  if not found then raise exception 'snapshot_not_found'; end if;
  if v_snapshot.status<>'sealed' then raise exception 'snapshot_not_sealed'; end if;

  select * into v_source from public.curriculum_authority_sources where id=v_snapshot.source_id;
  if not found or v_source.source_status<>'approved' then raise exception 'source_not_approved'; end if;

  select count(*)::integer,
         encode(extensions.digest(convert_to(coalesce(string_agg(row_sha256,'|' order by observation_key),''),'UTF8'),'sha256'),'hex')
  into v_count,v_hash
  from public.curriculum_authority_observations
  where snapshot_id=p_snapshot_id;

  if v_count is distinct from v_snapshot.observation_count then
    raise exception 'sealed_snapshot_count_mismatch';
  end if;
  if v_hash is distinct from v_snapshot.snapshot_sha256 then
    raise exception 'sealed_snapshot_checksum_mismatch';
  end if;

  delete from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id;

  for o in
    select * from public.curriculum_authority_observations
    where snapshot_id=p_snapshot_id order by observation_key
  loop
    v_hierarchy_count := 0;
    v_sub_strand_id := null;
    v_official_exact := null;
    v_official_code_conflict := null;
    v_creator_exact := null;

    if public.curriculum_authority_normalize_text(o.curriculum_framework)
         <> public.curriculum_authority_normalize_text(v_source.curriculum_framework)
       or public.curriculum_authority_normalize_text(o.grade)
         <> public.curriculum_authority_normalize_text(v_source.grade)
       or public.curriculum_authority_normalize_text(o.subject_label)
         <> public.curriculum_authority_normalize_text(v_source.subject_label) then
      v_classification := 'scope_mismatch';
    else
      select count(*)::integer,min(cs.id)
      into v_hierarchy_count,v_sub_strand_id
      from public.cbc_strands cs
      where cs.subject_id=v_source.canonical_subject_id
        and public.curriculum_authority_normalize_text(cs.grade)=public.curriculum_authority_normalize_text(v_source.grade)
        and public.curriculum_authority_normalize_text(cs.name)=public.curriculum_authority_normalize_text(o.strand)
        and public.curriculum_authority_normalize_text(coalesce(cs.sub_strand,''))=public.curriculum_authority_normalize_text(o.sub_strand)
        and cs.term is null and cs.week is null;

      if v_hierarchy_count=0 then
        v_classification := 'missing_hierarchy';
      elsif v_hierarchy_count>1 then
        v_classification := 'official_conflict';
        v_sub_strand_id := null;
      else
        select clo.id into v_official_code_conflict
        from public.curriculum_learning_outcomes clo
        where clo.sub_strand_id=v_sub_strand_id
          and clo.source_type='official'
          and clo.status in ('active','verified')
          and nullif(public.curriculum_authority_normalize_text(o.outcome_code),'') is not null
          and public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code)
          and public.curriculum_authority_normalize_text(clo.outcome_text)<>public.curriculum_authority_normalize_text(o.outcome_text)
        order by clo.id limit 1;

        if v_official_code_conflict is not null then
          v_classification := 'official_conflict';
        else
          select clo.id into v_official_exact
          from public.curriculum_learning_outcomes clo
          where clo.sub_strand_id=v_sub_strand_id
            and clo.source_type='official'
            and clo.status in ('active','verified')
            and public.curriculum_authority_normalize_text(clo.outcome_text)=public.curriculum_authority_normalize_text(o.outcome_text)
            and (
              nullif(public.curriculum_authority_normalize_text(o.outcome_code),'') is null
              or public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code)
            )
          order by clo.id limit 1;

          if v_official_exact is not null then
            v_classification := 'exact_official';
          else
            select clo.id into v_creator_exact
            from public.curriculum_learning_outcomes clo
            where clo.sub_strand_id=v_sub_strand_id
              and clo.source_type='creator_claimed'
              and clo.status in ('draft','active','verified')
              and public.curriculum_authority_normalize_text(clo.outcome_text)=public.curriculum_authority_normalize_text(o.outcome_text)
              and (
                nullif(public.curriculum_authority_normalize_text(o.outcome_code),'') is null
                or public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(o.outcome_code)
              )
            order by clo.id limit 1;

            if v_creator_exact is not null then
              v_classification := 'creator_claimed_replacement_candidate';
            else
              v_classification := 'missing_outcome';
            end if;
          end if;
        end if;
      end if;
    end if;

    insert into public.curriculum_authority_reconciliation(
      snapshot_id,observation_id,classification,target_sub_strand_id,target_outcome_id,details
    ) values (
      p_snapshot_id,o.id,v_classification,v_sub_strand_id,
      coalesce(v_official_exact,v_official_code_conflict,v_creator_exact),
      jsonb_build_object(
        'canonical_subject_id',v_source.canonical_subject_id,
        'hierarchy_match_count',coalesce(v_hierarchy_count,0),
        'official_code_conflict_id',v_official_code_conflict,
        'creator_claimed_candidate_id',v_creator_exact
      )
    );

    v_counts := jsonb_set(
      v_counts,
      array[v_classification],
      to_jsonb(coalesce((v_counts->>v_classification)::integer,0)+1),
      true
    );
  end loop;

  update public.curriculum_authority_snapshots
  set status='reconciled',reconciled_at=now(),updated_at=now()
  where id=p_snapshot_id;

  return jsonb_build_object('snapshot_id',p_snapshot_id,'classifications',v_counts);
end
$$;

create or replace function public.curriculum_authority_promote_snapshot(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_snapshot public.curriculum_authority_snapshots%rowtype;
  v_source public.curriculum_authority_sources%rowtype;
  v_artifact public.curriculum_authority_artifacts%rowtype;
  v_count integer;
  v_hash text;
  r record;
  v_current_hierarchy_count integer;
  v_current_sub_strand_id uuid;
  v_existing_official_id uuid;
  v_conflict_id uuid;
  v_outcome_id uuid;
  v_action text;
  v_inserted integer := 0;
  v_matched integer := 0;
  v_tags text[];
begin
  perform public.hq_assert_owner();
  if v_owner is null then raise exception 'authentication_required'; end if;

  select * into v_snapshot from public.curriculum_authority_snapshots
  where id=p_snapshot_id for update;
  if not found then raise exception 'snapshot_not_found'; end if;
  if v_snapshot.status<>'reconciled' then raise exception 'snapshot_not_reconciled'; end if;

  select * into v_source from public.curriculum_authority_sources where id=v_snapshot.source_id;
  select * into v_artifact from public.curriculum_authority_artifacts where id=v_snapshot.artifact_id;
  if v_source.source_status<>'approved' then raise exception 'source_not_approved'; end if;
  if v_artifact.source_id<>v_source.id then raise exception 'artifact_source_mismatch'; end if;

  select count(*)::integer,
         encode(extensions.digest(convert_to(coalesce(string_agg(row_sha256,'|' order by observation_key),''),'UTF8'),'sha256'),'hex')
  into v_count,v_hash
  from public.curriculum_authority_observations
  where snapshot_id=p_snapshot_id;

  if v_count is distinct from v_snapshot.observation_count then
    raise exception 'sealed_snapshot_count_mismatch';
  end if;
  if v_hash is distinct from v_snapshot.snapshot_sha256 then
    raise exception 'sealed_snapshot_checksum_mismatch';
  end if;
  if (select count(*) from public.curriculum_authority_reconciliation where snapshot_id=p_snapshot_id)
       <> v_snapshot.observation_count then
    raise exception 'snapshot_reconciliation_incomplete';
  end if;
  if exists (
    select 1 from public.curriculum_authority_reconciliation
    where snapshot_id=p_snapshot_id
      and classification in ('official_conflict','scope_mismatch')
  ) then
    raise exception 'snapshot_has_unresolved_conflicts';
  end if;
  if exists (
    select 1 from public.curriculum_authority_reconciliation
    where snapshot_id=p_snapshot_id and classification='missing_hierarchy'
  ) then
    raise exception 'snapshot_requires_hierarchy_resolution';
  end if;

  for r in
    select
      rr.observation_id,
      rr.classification,
      rr.target_sub_strand_id,
      o.observation_key,
      o.strand,
      o.sub_strand,
      o.outcome_text,
      o.outcome_code,
      o.difficulty,
      o.competencies,
      o.source_locator
    from public.curriculum_authority_reconciliation rr
    join public.curriculum_authority_observations o on o.id=rr.observation_id
    where rr.snapshot_id=p_snapshot_id
    order by o.observation_key
  loop
    select count(*)::integer,min(cs.id)
    into v_current_hierarchy_count,v_current_sub_strand_id
    from public.cbc_strands cs
    where cs.subject_id=v_source.canonical_subject_id
      and public.curriculum_authority_normalize_text(cs.grade)=public.curriculum_authority_normalize_text(v_source.grade)
      and public.curriculum_authority_normalize_text(cs.name)=public.curriculum_authority_normalize_text(r.strand)
      and public.curriculum_authority_normalize_text(coalesce(cs.sub_strand,''))=public.curriculum_authority_normalize_text(r.sub_strand)
      and cs.term is null and cs.week is null;

    if v_current_hierarchy_count<>1
       or v_current_sub_strand_id is distinct from r.target_sub_strand_id then
      raise exception 'hierarchy_changed_since_reconciliation';
    end if;

    v_existing_official_id := null;
    v_conflict_id := null;

    select clo.id into v_conflict_id
    from public.curriculum_learning_outcomes clo
    where clo.sub_strand_id=v_current_sub_strand_id
      and clo.source_type='official'
      and clo.status in ('active','verified')
      and nullif(public.curriculum_authority_normalize_text(r.outcome_code),'') is not null
      and public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(r.outcome_code)
      and public.curriculum_authority_normalize_text(clo.outcome_text)<>public.curriculum_authority_normalize_text(r.outcome_text)
    order by clo.id limit 1;

    if v_conflict_id is not null then
      raise exception 'official_outcome_conflict_at_promotion';
    end if;

    select clo.id into v_existing_official_id
    from public.curriculum_learning_outcomes clo
    where clo.sub_strand_id=v_current_sub_strand_id
      and clo.source_type='official'
      and clo.status in ('active','verified')
      and public.curriculum_authority_normalize_text(clo.outcome_text)=public.curriculum_authority_normalize_text(r.outcome_text)
      and (
        nullif(public.curriculum_authority_normalize_text(r.outcome_code),'') is null
        or public.curriculum_authority_normalize_text(clo.outcome_code)=public.curriculum_authority_normalize_text(r.outcome_code)
      )
    order by clo.id limit 1;

    if v_existing_official_id is not null then
      v_outcome_id := v_existing_official_id;
      v_action := 'matched_existing_official';
      v_matched := v_matched+1;
    else
      if jsonb_typeof(r.competencies)='array' then
        select coalesce(array_agg(x),array[]::text[]) into v_tags
        from jsonb_array_elements_text(r.competencies) x;
      else
        v_tags := array[]::text[];
      end if;

      insert into public.curriculum_learning_outcomes(
        curriculum_id,sub_strand_id,outcome_text,outcome_code,source_type,source_ref,
        difficulty,competency_tags,status,verified_by,verified_at,created_by,created_at,updated_at
      ) values (
        null,v_current_sub_strand_id,r.outcome_text,nullif(btrim(r.outcome_code),''),
        'official',
        v_artifact.source_url || case when r.source_locator is null then '' else '#'||r.source_locator end,
        case when r.difficulty in ('foundation','developing','proficient','advanced') then r.difficulty else null end,
        coalesce(v_tags,array[]::text[]),
        'active',v_owner,now(),v_owner,now(),now()
      )
      returning id into v_outcome_id;

      v_action := 'inserted_official';
      v_inserted := v_inserted+1;
    end if;

    insert into public.curriculum_authority_promotions(
      snapshot_id,observation_id,target_sub_strand_id,outcome_id,action,promoted_by,evidence
    ) values (
      p_snapshot_id,r.observation_id,v_current_sub_strand_id,v_outcome_id,v_action,v_owner,
      jsonb_build_object(
        'source_id',v_source.id,
        'artifact_id',v_artifact.id,
        'artifact_sha256',v_artifact.content_sha256,
        'snapshot_sha256',v_snapshot.snapshot_sha256,
        'source_locator',r.source_locator,
        'preserved_creator_claimed_history',true
      )
    )
    on conflict (snapshot_id,observation_id) do nothing;
  end loop;

  update public.curriculum_authority_snapshots
  set status='promoted',promoted_at=now(),updated_at=now()
  where id=p_snapshot_id;

  return jsonb_build_object(
    'success',true,'snapshot_id',p_snapshot_id,
    'inserted_official',v_inserted,'matched_existing_official',v_matched
  );
end
$$;

create or replace function public.curriculum_authority_get_snapshot_review(p_snapshot_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_snapshot public.curriculum_authority_snapshots%rowtype; v_source public.curriculum_authority_sources%rowtype; v_artifact public.curriculum_authority_artifacts%rowtype; v_counts jsonb;
begin
  perform public.hq_assert_owner();
  select * into v_snapshot from public.curriculum_authority_snapshots where id=p_snapshot_id;
  if not found then raise exception 'snapshot_not_found'; end if;
  select * into v_source from public.curriculum_authority_sources where id=v_snapshot.source_id;
  select * into v_artifact from public.curriculum_authority_artifacts where id=v_snapshot.artifact_id;

  select coalesce(jsonb_object_agg(classification,cnt),'{}'::jsonb) into v_counts
  from (
    select classification,count(*)::integer cnt
    from public.curriculum_authority_reconciliation
    where snapshot_id=p_snapshot_id
    group by classification
  ) q;

  return jsonb_build_object(
    'snapshot_id',v_snapshot.id,
    'status',v_snapshot.status,
    'authority_name',v_source.authority_name,
    'curriculum_framework',v_source.curriculum_framework,
    'grade',v_source.grade,
    'subject_label',v_source.subject_label,
    'source_url',v_artifact.source_url,
    'source_version',v_artifact.source_version,
    'artifact_sha256',v_artifact.content_sha256,
    'observation_count',v_snapshot.observation_count,
    'snapshot_sha256',v_snapshot.snapshot_sha256,
    'classifications',v_counts
  );
end
$$;

-- Browser roles never stage raw authority evidence. Service automation gets the
-- ingestion lane; authenticated users only get owner-gated review/promotion.
revoke all on function public.curriculum_authority_register_source(text,text,text,uuid,text,text,date,jsonb) from public,anon,authenticated;
grant execute on function public.curriculum_authority_register_source(text,text,text,uuid,text,text,date,jsonb) to authenticated;

revoke all on function public.curriculum_authority_register_artifact(uuid,text,text,date,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.curriculum_authority_register_artifact(uuid,text,text,date,text,text,jsonb) to service_role;

revoke all on function public.curriculum_authority_create_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.curriculum_authority_create_snapshot(uuid,uuid) to service_role;

revoke all on function public.curriculum_authority_add_observation(uuid,text,text,text,text,text,text,text,text,text,integer,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.curriculum_authority_add_observation(uuid,text,text,text,text,text,text,text,text,text,integer,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,jsonb) to service_role;

revoke all on function public.curriculum_authority_seal_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.curriculum_authority_seal_snapshot(uuid) to service_role;

revoke all on function public.curriculum_authority_reconcile_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.curriculum_authority_reconcile_snapshot(uuid) to service_role;

revoke all on function public.curriculum_authority_promote_snapshot(uuid) from public,anon;
grant execute on function public.curriculum_authority_promote_snapshot(uuid) to authenticated;

revoke all on function public.curriculum_authority_get_snapshot_review(uuid) from public,anon;
grant execute on function public.curriculum_authority_get_snapshot_review(uuid) to authenticated;

comment on table public.curriculum_authority_sources is
'Owner-approved source registry binding one authority source to an existing global subject identity.';
comment on table public.curriculum_authority_artifacts is
'Immutable source artifact evidence identified by SHA-256.';
comment on table public.curriculum_authority_observations is
'Service-staged normalized curriculum observations with retained raw source payload and deterministic row hash.';
comment on function public.curriculum_authority_promote_snapshot(uuid) is
'HQ-owner promotion of reconciled official outcomes onto the existing unpaced cbc_strands hierarchy. Never invents school term/week pacing and never overwrites creator-claimed history.';

commit;
