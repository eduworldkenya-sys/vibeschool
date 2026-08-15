-- WE-R1.3X X8: Factory Reconciliation. NON-ACTIVATING.
-- Factory creation is replaced by evidence-first last-resort diagnosis during reconciliation.
-- access: service-only public.hq_workforce_factory_diagnoses
-- authorization-test: public.hq_workforce_factory_diagnoses denies anon/authenticated direct access; append-only Factory recommendation evidence.

update public.hq_workforce_engine_contract
set heartbeat_enabled=false,factory_enabled=false,runtime_execution_enabled=false,
    runtime_autonomy_level=0,runtime_max_risk=0,shadow_enabled=false,
    shadow_scheduler_enabled=false,shadow_global_stop=true,updated_at=clock_timestamp()
where singleton=true;

create table public.hq_workforce_factory_diagnoses (
  id bigint generated always as identity primary key,
  objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
  plan_id uuid references public.hq_workforce_plans(id) on delete restrict,
  diagnosis_status text not null check(diagnosis_status in (
    'no_selected_plan','resource_gap','capability_gap','skill_gap','reuse_or_collaboration','temporary_capacity','human_judgment','persistent_worker_gap'
  )),
  required_capabilities uuid[] not null default '{}'::uuid[],
  required_competencies text[] not null default '{}'::text[],
  blockers jsonb not null default '[]'::jsonb check(jsonb_typeof(blockers)='array'),
  alternatives_checked jsonb not null check(jsonb_typeof(alternatives_checked)='object'),
  factory_recommendation boolean not null default false,
  recommendation jsonb not null default '{}'::jsonb check(jsonb_typeof(recommendation)='object'),
  consequential_execution boolean not null default false check(consequential_execution=false),
  created_at timestamptz not null default clock_timestamp(),
  check(not factory_recommendation or diagnosis_status='persistent_worker_gap')
);
create index hq_workforce_factory_diagnoses_objective_idx on public.hq_workforce_factory_diagnoses(objective_id,created_at desc,id desc);

create or replace function public.hq_workforce_factory_diagnoses_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception 'worker_engine_factory_diagnosis_is_append_only'; end $$;
create trigger trg_hq_workforce_factory_diagnoses_immutable before update or delete on public.hq_workforce_factory_diagnoses
for each row execute function public.hq_workforce_factory_diagnoses_immutable();

create or replace function public.hq_workforce_diagnose_factory_gap(p_objective_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  o public.hq_workforce_objectives%rowtype;
  p public.hq_workforce_plans%rowtype;
  req_caps uuid[]:='{}'::uuid[];
  req_comps text[]:='{}'::text[];
  resource_gap_count integer:=0;
  capability_gap_count integer:=0;
  skill_gap_count integer:=0;
  missing_worker_comp_count integer:=0;
  overloaded_worker_comp_count integer:=0;
  human_available boolean:=false;
  status text;
  factory_ok boolean:=false;
  blockers jsonb:='[]'::jsonb;
  alternatives jsonb;
  recommendation jsonb:='{}'::jsonb;
  v_id bigint;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then
    raise exception 'x8_factory_diagnosis_requires_factory_execution_off_l0_r0';
  end if;
  select * into o from public.hq_workforce_objectives where id=p_objective_id;
  if not found then raise exception 'objective_not_found'; end if;

  select * into p from public.hq_workforce_plans where objective_id=o.id and status='selected' order by updated_at desc,id limit 1;
  if not found then
    status:='no_selected_plan';
    blockers:=jsonb_build_array(jsonb_build_object('stage','planning','reason','no_selected_plan'));
    alternatives:=jsonb_build_object('routing',false,'resource_resolution',false,'capability_composition',false,'skill_resolution',false,'collaboration',false,'capacity',false,'human_judgment',false);
  else
    select coalesce(array_agg(distinct psc.capability_id order by psc.capability_id),'{}'::uuid[])
      into req_caps
    from public.hq_workforce_plan_steps ps join public.hq_workforce_plan_step_capabilities psc on psc.plan_step_id=ps.id
    where ps.plan_id=p.id and psc.role='required';

    select coalesce(array_agg(distinct cc.competency_key order by cc.competency_key),'{}'::text[])
      into req_comps
    from public.hq_workforce_plan_steps ps
    join public.hq_workforce_plan_step_capabilities psc on psc.plan_step_id=ps.id and psc.role='required'
    join public.hq_workforce_capability_competencies cc on cc.capability_id=psc.capability_id and cc.required
    where ps.plan_id=p.id;

    select count(*) into capability_gap_count from unnest(req_caps) c(id)
    where not exists(select 1 from public.hq_workforce_capabilities x where x.id=c.id and x.lifecycle_status in ('tested','certified') and x.autonomy_ceiling>=0 and x.risk_class=0);

    select count(*) into resource_gap_count
    from public.hq_workforce_plan_steps ps
    join public.hq_workforce_plan_step_capabilities psc on psc.plan_step_id=ps.id and psc.role='required'
    where ps.plan_id=p.id and not exists(
      select 1 from public.hq_workforce_plan_step_resources psr
      join public.hq_workforce_resources r on r.id=psr.resource_id
      where psr.plan_step_id=ps.id and psr.capability_id=psc.capability_id and psr.required
        and r.enabled and r.shadow_capable and r.health_status in ('healthy','degraded')
        and r.required_autonomy=0 and r.risk_class=0 and (r.valid_until is null or r.valid_until>clock_timestamp())
    );

    select count(*) into skill_gap_count from unnest(req_caps) c(id)
    where not exists(
      select 1 from public.hq_workforce_skill_capabilities sc
      join public.hq_workforce_skill_manifests sm on sm.id=sc.skill_manifest_id
      where sc.capability_id=c.id and sc.role in ('implements','supports') and sm.certification_status='certified' and sm.shadow_capable and sc.coverage>0
    );

    select count(*) into missing_worker_comp_count from unnest(req_comps) q(comp)
    where not exists(
      select 1 from public.hq_workforce_worker_competencies wc join public.hq_workforce_workers w on w.worker_key=wc.worker_key
      where wc.competency_key=q.comp and wc.certification_status='certified' and (wc.expires_at is null or wc.expires_at>clock_timestamp())
        and w.status='active' and (o.scope_type=any(wc.scope_types) or 'global'=any(wc.scope_types)) and ('global'=any(wc.jurisdictions))
    );

    select count(*) into overloaded_worker_comp_count from unnest(req_comps) q(comp)
    where exists(
      select 1 from public.hq_workforce_worker_competencies wc join public.hq_workforce_workers w on w.worker_key=wc.worker_key
      where wc.competency_key=q.comp and wc.certification_status='certified' and (wc.expires_at is null or wc.expires_at>clock_timestamp()) and w.status='active'
    ) and not exists(
      select 1 from public.hq_workforce_worker_competencies wc join public.hq_workforce_workers w on w.worker_key=wc.worker_key
      where wc.competency_key=q.comp and wc.certification_status='certified' and (wc.expires_at is null or wc.expires_at>clock_timestamp()) and w.status='active'
        and (select count(*) from public.hq_workforce_assignments a where a.worker_key=w.worker_key and a.active)<20
    );

    select exists(select 1 from public.hq_workforce_resources r where r.resource_kind='human_reviewer' and r.enabled and r.health_status in ('healthy','degraded') and r.required_autonomy=0 and r.risk_class=0 and (r.valid_until is null or r.valid_until>clock_timestamp())) into human_available;

    alternatives:=jsonb_build_object(
      'routing_checked',true,
      'resource_resolution_checked',true,
      'capability_composition_checked',true,
      'certified_skill_resolution_checked',true,
      'collaboration_checked',true,
      'capacity_checked',true,
      'human_judgment_checked',true,
      'required_capability_count',cardinality(req_caps),
      'required_competency_count',cardinality(req_comps),
      'resource_gap_count',resource_gap_count,
      'capability_gap_count',capability_gap_count,
      'skill_gap_count',skill_gap_count,
      'missing_worker_competency_count',missing_worker_comp_count,
      'capacity_pressure_count',overloaded_worker_comp_count,
      'human_reviewer_available',human_available
    );

    if capability_gap_count>0 then status:='capability_gap'; blockers:=jsonb_build_array(jsonb_build_object('stage','capability','count',capability_gap_count));
    elsif resource_gap_count>0 then status:='resource_gap'; blockers:=jsonb_build_array(jsonb_build_object('stage','resource','count',resource_gap_count));
    elsif skill_gap_count>0 then status:='skill_gap'; blockers:=jsonb_build_array(jsonb_build_object('stage','skill_certification','count',skill_gap_count,'automatic_certification',false));
    elsif cardinality(req_comps)=0 then status:='capability_gap'; blockers:=jsonb_build_array(jsonb_build_object('stage','competency_contract','reason','required_capabilities_have_no_competency_contract'));
    elsif missing_worker_comp_count=0 and overloaded_worker_comp_count>0 then status:='temporary_capacity'; blockers:=jsonb_build_array(jsonb_build_object('stage','capacity','count',overloaded_worker_comp_count,'worker_creation_not_justified',true));
    elsif missing_worker_comp_count=0 then status:='reuse_or_collaboration';
    elsif human_available then status:='human_judgment'; blockers:=jsonb_build_array(jsonb_build_object('stage','human_judgment','reason','governed_human_reviewer_available_before_worker_creation'));
    else
      status:='persistent_worker_gap'; factory_ok:=true;
      blockers:=jsonb_build_array(jsonb_build_object('stage','worker_capacity','missing_competencies',missing_worker_comp_count));
      recommendation:=jsonb_build_object(
        'action','propose_probation_worker_gap_for_human_review',
        'automatic_worker_creation',false,
        'automatic_certification',false,
        'automatic_authority',false,
        'required_competencies',req_comps,
        'reason','all_cheaper_reuse_resource_capability_skill_collaboration_capacity_and_human_options_exhausted'
      );
    end if;
  end if;

  insert into public.hq_workforce_factory_diagnoses(objective_id,plan_id,diagnosis_status,required_capabilities,required_competencies,blockers,alternatives_checked,factory_recommendation,recommendation)
  values(o.id,p.id,status,req_caps,req_comps,blockers,alternatives,factory_ok,recommendation) returning id into v_id;

  return jsonb_build_object('status',status,'diagnosis_id',v_id,'objective_id',o.id,'plan_id',p.id,'factory_recommendation',factory_ok,
    'required_capabilities',req_caps,'required_competencies',req_comps,'blockers',blockers,'alternatives_checked',alternatives,
    'recommendation',recommendation,'factory_enabled',false,'worker_created',false,'worker_certified',false,'authority_granted',false,'consequential_execution',false);
end $$;

alter table public.hq_workforce_factory_diagnoses enable row level security;
revoke all on table public.hq_workforce_factory_diagnoses from public,anon,authenticated;
grant select,insert on table public.hq_workforce_factory_diagnoses to service_role;
revoke all on sequence public.hq_workforce_factory_diagnoses_id_seq from public,anon,authenticated;
grant usage,select on sequence public.hq_workforce_factory_diagnoses_id_seq to service_role;
revoke all on function public.hq_workforce_factory_diagnoses_immutable() from public,anon,authenticated;
revoke all on function public.hq_workforce_diagnose_factory_gap(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_diagnose_factory_gap(uuid) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'X8 requires engine contract'; end if;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0
     or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then
    raise exception 'X8 Factory reconciliation violated fail-closed L0/R0 boundary';
  end if;
end $$;