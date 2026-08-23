begin;

-- Governed subject-specialization layer for reusable Worker Engine roles.
-- NON-ACTIVATING: this migration does not enable runtime, scheduler, publishing,
-- payments, autonomy, or consequential authority. Chemistry is a proving workload,
-- not an organizational department.

-- access: service-only public.hq_workforce_worker_specializations
-- authorization-test: public.hq_workforce_worker_specializations denies public/anon/authenticated direct access and uses explicit service_role grants only.
create table if not exists public.hq_workforce_worker_specializations (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  specialization_key text not null,
  subject_key text not null,
  grade_key text,
  specialization_version integer not null check (specialization_version > 0),
  capabilities text[] not null default '{}',
  qualification_state text not null default 'candidate'
    check (qualification_state in ('candidate','qualified','restricted','expired','revoked')),
  evidence jsonb not null default '{}'::jsonb,
  qualified_at timestamptz,
  qualified_until timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(worker_key, specialization_key, specialization_version)
);

-- access: service-only public.hq_workforce_mission_capability_requirements
-- authorization-test: public.hq_workforce_mission_capability_requirements denies public/anon/authenticated direct access and uses explicit service_role grants only.
create table if not exists public.hq_workforce_mission_capability_requirements (
  id uuid primary key default gen_random_uuid(),
  mission_kind text not null,
  stage_key text not null,
  specialization_key text not null,
  required_capabilities text[] not null default '{}',
  minimum_specialization_version integer not null default 1 check (minimum_specialization_version > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(mission_kind, stage_key, specialization_key)
);

-- access: service-only public.hq_workforce_mission_specialization_bindings
-- authorization-test: public.hq_workforce_mission_specialization_bindings denies public/anon/authenticated direct access and uses explicit service_role grants only.
create table if not exists public.hq_workforce_mission_specialization_bindings (
  id uuid primary key default gen_random_uuid(),
  mission_ref text not null,
  cyborg_mission_id uuid references public.hq_cyborg_missions(id) on delete restrict,
  stage_key text not null,
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  specialization_key text not null,
  specialization_version integer not null check (specialization_version > 0),
  cyborg_lease_generation bigint,
  evidence_hash text not null,
  bound_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  released_at timestamptz,
  unique(mission_ref, stage_key, worker_key)
);

create index if not exists hq_worker_specializations_lookup
  on public.hq_workforce_worker_specializations(specialization_key, qualification_state, specialization_version desc);
create index if not exists hq_mission_capability_requirements_lookup
  on public.hq_workforce_mission_capability_requirements(mission_kind, stage_key) where enabled;
create index if not exists hq_mission_specialization_bindings_active
  on public.hq_workforce_mission_specialization_bindings(mission_ref, stage_key) where released_at is null;

alter table public.hq_workforce_worker_specializations enable row level security;
alter table public.hq_workforce_mission_capability_requirements enable row level security;
alter table public.hq_workforce_mission_specialization_bindings enable row level security;

revoke all on public.hq_workforce_worker_specializations,
  public.hq_workforce_mission_capability_requirements,
  public.hq_workforce_mission_specialization_bindings
from public, anon, authenticated, service_role;

grant select,insert,update on public.hq_workforce_worker_specializations,
  public.hq_workforce_mission_capability_requirements,
  public.hq_workforce_mission_specialization_bindings
to service_role;

insert into public.hq_workforce_worker_specializations(
  worker_key,specialization_key,subject_key,grade_key,specialization_version,
  capabilities,qualification_state,evidence
)
select w.worker_key,'chemistry.grade10','chemistry','10',1,
  case w.worker_key
    when 'content-factory-r2-canary-01' then array[
      'curriculum_chemistry_grade10','chemistry_scientific_accuracy','chemistry_instructional_authoring',
      'chemistry_equations_units','chemistry_lab_safety','kenyan_classroom_context'
    ]::text[]
    when 'quality-worker-01' then array[
      'curriculum_chemistry_grade10','chemistry_scientific_accuracy','chemistry_quality_rubric',
      'chemistry_equations_units','chemistry_lab_safety','chemistry_assessment_integrity'
    ]::text[]
    when 'content-critic-chemistry-v1' then array[
      'curriculum_chemistry_grade10','chemistry_scientific_accuracy','chemistry_independent_criticism',
      'chemistry_equations_units','chemistry_lab_safety','chemistry_assessment_integrity',
      'chemistry_misconception_detection','kenyan_classroom_feasibility'
    ]::text[]
    when 'content-repair-chemistry-v1' then array[
      'curriculum_chemistry_grade10','chemistry_scientific_accuracy','chemistry_bounded_repair',
      'chemistry_equations_units','chemistry_lab_safety','chemistry_assessment_integrity',
      'chemistry_regression_avoidance'
    ]::text[]
  end,
  'candidate',
  jsonb_build_object(
    'source','grade-10-chemistry-proving-mission',
    'organizational_department',w.department_key,
    'note','subject specialization does not create subject department or authority'
  )
from public.hq_workforce_workers w
where w.worker_key in (
  'content-factory-r2-canary-01','quality-worker-01',
  'content-critic-chemistry-v1','content-repair-chemistry-v1'
)
on conflict(worker_key,specialization_key,specialization_version) do update set
  subject_key=excluded.subject_key,
  grade_key=excluded.grade_key,
  capabilities=excluded.capabilities,
  evidence=excluded.evidence,
  updated_at=clock_timestamp();

insert into public.hq_workforce_mission_capability_requirements(
  mission_kind,stage_key,specialization_key,required_capabilities,minimum_specialization_version
) values
('curriculum_content','AUTHOR','chemistry.grade10',array[
  'curriculum_chemistry_grade10','chemistry_scientific_accuracy','chemistry_instructional_authoring','chemistry_lab_safety'
],1),
('curriculum_content','QUALITY','chemistry.grade10',array[
  'curriculum_chemistry_grade10','chemistry_scientific_accuracy','chemistry_quality_rubric','chemistry_lab_safety'
],1),
('curriculum_content','CRITIC','chemistry.grade10',array[
  'curriculum_chemistry_grade10','chemistry_scientific_accuracy','chemistry_independent_criticism',
  'chemistry_lab_safety','chemistry_assessment_integrity'
],1),
('curriculum_content','REPAIR','chemistry.grade10',array[
  'curriculum_chemistry_grade10','chemistry_scientific_accuracy','chemistry_bounded_repair',
  'chemistry_lab_safety','chemistry_regression_avoidance'
],1),
('curriculum_content','RECRITIC','chemistry.grade10',array[
  'curriculum_chemistry_grade10','chemistry_scientific_accuracy','chemistry_independent_criticism',
  'chemistry_lab_safety','chemistry_assessment_integrity'
],1)
on conflict(mission_kind,stage_key,specialization_key) do update set
  required_capabilities=excluded.required_capabilities,
  minimum_specialization_version=excluded.minimum_specialization_version,
  enabled=true,
  updated_at=clock_timestamp();

create or replace function public.hq_workforce_assert_worker_specialization(
  p_worker_key text,
  p_mission_kind text,
  p_stage_key text,
  p_specialization_key text
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  r public.hq_workforce_mission_capability_requirements%rowtype;
  s public.hq_workforce_worker_specializations%rowtype;
begin
  select * into r
  from public.hq_workforce_mission_capability_requirements
  where mission_kind=p_mission_kind
    and stage_key=upper(p_stage_key)
    and specialization_key=p_specialization_key
    and enabled;
  if not found then raise exception 'SPECIALIZATION_REQUIREMENT_MISSING'; end if;

  select * into s
  from public.hq_workforce_worker_specializations
  where worker_key=p_worker_key
    and specialization_key=p_specialization_key
    and specialization_version >= r.minimum_specialization_version
    and qualification_state='qualified'
    and (qualified_until is null or qualified_until > clock_timestamp())
  order by specialization_version desc
  limit 1;
  if not found then raise exception 'WORKER_SPECIALIZATION_NOT_QUALIFIED:%:%',p_worker_key,p_specialization_key; end if;

  if not (r.required_capabilities <@ s.capabilities) then
    raise exception 'WORKER_SPECIALIZATION_CAPABILITY_MISMATCH:%:%',p_worker_key,p_stage_key;
  end if;

  return jsonb_build_object(
    'decision','pass','worker_key',s.worker_key,'stage',upper(p_stage_key),
    'specialization_key',s.specialization_key,'specialization_version',s.specialization_version,
    'required_capabilities',to_jsonb(r.required_capabilities)
  );
end $$;

create or replace function public.hq_workforce_bind_worker_specialization_to_cyborg_lease(
  p_mission_ref text,
  p_cyborg_mission_id uuid,
  p_stage_key text,
  p_worker_key text,
  p_mission_kind text,
  p_specialization_key text,
  p_expected_lease_generation bigint,
  p_evidence_hash text
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  a jsonb;
  l public.hq_cyborg_mission_leases%rowtype;
  v_version integer;
begin
  if nullif(trim(p_mission_ref),'') is null then raise exception 'MISSION_REF_REQUIRED'; end if;
  if nullif(trim(p_evidence_hash),'') is null then raise exception 'SPECIALIZATION_EVIDENCE_HASH_REQUIRED'; end if;

  a:=public.hq_workforce_assert_worker_specialization(
    p_worker_key,p_mission_kind,upper(p_stage_key),p_specialization_key
  );
  v_version:=(a->>'specialization_version')::integer;

  select * into l from public.hq_cyborg_mission_leases where mission_id=p_cyborg_mission_id;
  if not found then raise exception 'CYBORG_MISSION_LEASE_REQUIRED'; end if;
  if l.expires_at <= clock_timestamp() then raise exception 'CYBORG_MISSION_LEASE_EXPIRED'; end if;
  if l.generation <> p_expected_lease_generation then raise exception 'CYBORG_MISSION_LEASE_GENERATION_MISMATCH'; end if;

  insert into public.hq_workforce_mission_specialization_bindings(
    mission_ref,cyborg_mission_id,stage_key,worker_key,specialization_key,
    specialization_version,cyborg_lease_generation,evidence_hash,expires_at
  ) values(
    p_mission_ref,p_cyborg_mission_id,upper(p_stage_key),p_worker_key,p_specialization_key,
    v_version,l.generation,p_evidence_hash,l.expires_at
  )
  on conflict(mission_ref,stage_key,worker_key) do update set
    cyborg_mission_id=excluded.cyborg_mission_id,
    specialization_key=excluded.specialization_key,
    specialization_version=excluded.specialization_version,
    cyborg_lease_generation=excluded.cyborg_lease_generation,
    evidence_hash=excluded.evidence_hash,
    bound_at=clock_timestamp(),
    expires_at=excluded.expires_at,
    released_at=null;

  return a || jsonb_build_object(
    'cyborg_mission_id',p_cyborg_mission_id,
    'cyborg_lease_generation',l.generation,
    'lease_expires_at',l.expires_at,
    'mission_ref',p_mission_ref
  );
end $$;

create or replace function public.hq_workforce_assert_active_specialization_binding(
  p_mission_ref text,
  p_stage_key text,
  p_worker_key text,
  p_specialization_key text
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  b public.hq_workforce_mission_specialization_bindings%rowtype;
  l public.hq_cyborg_mission_leases%rowtype;
begin
  select * into b
  from public.hq_workforce_mission_specialization_bindings
  where mission_ref=p_mission_ref
    and stage_key=upper(p_stage_key)
    and worker_key=p_worker_key
    and specialization_key=p_specialization_key
    and released_at is null;
  if not found then raise exception 'ACTIVE_SPECIALIZATION_BINDING_REQUIRED'; end if;
  if b.expires_at is not null and b.expires_at <= clock_timestamp() then raise exception 'SPECIALIZATION_BINDING_EXPIRED'; end if;

  if b.cyborg_mission_id is null or b.cyborg_lease_generation is null then
    raise exception 'SPECIALIZATION_BINDING_NOT_CYBORG_LEASE_BOUND';
  end if;
  select * into l from public.hq_cyborg_mission_leases where mission_id=b.cyborg_mission_id;
  if not found or l.expires_at <= clock_timestamp() then raise exception 'SPECIALIZATION_CYBORG_LEASE_NOT_ACTIVE'; end if;
  if l.generation<>b.cyborg_lease_generation then raise exception 'SPECIALIZATION_BINDING_STALE_LEASE'; end if;

  perform public.hq_workforce_assert_worker_specialization(
    p_worker_key,'curriculum_content',upper(p_stage_key),p_specialization_key
  );

  return jsonb_build_object(
    'decision','pass','mission_ref',p_mission_ref,'stage',upper(p_stage_key),
    'worker_key',p_worker_key,'specialization_key',p_specialization_key,
    'specialization_version',b.specialization_version,
    'cyborg_lease_generation',b.cyborg_lease_generation,
    'evidence_hash',b.evidence_hash
  );
end $$;

revoke all on function public.hq_workforce_assert_worker_specialization(text,text,text,text),
  public.hq_workforce_bind_worker_specialization_to_cyborg_lease(text,uuid,text,text,text,text,bigint,text),
  public.hq_workforce_assert_active_specialization_binding(text,text,text,text)
from public,anon,authenticated;
grant execute on function public.hq_workforce_assert_worker_specialization(text,text,text,text),
  public.hq_workforce_bind_worker_specialization_to_cyborg_lease(text,uuid,text,text,text,text,bigint,text),
  public.hq_workforce_assert_active_specialization_binding(text,text,text,text)
to service_role;

do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_bad integer;
begin
  select count(*) into v_bad
  from public.hq_workforce_workers
  where lower(coalesce(department_key,''))='chemistry';
  if v_bad<>0 then raise exception 'SUBJECT_MUST_NOT_BECOME_DEPARTMENT'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'SPECIALIZATION_REQUIRES_ENGINE_CONTRACT'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'SPECIALIZATION_MIGRATION_NON_ACTIVATING_BOUNDARY_VIOLATED';
  end if;
end $$;

commit;
