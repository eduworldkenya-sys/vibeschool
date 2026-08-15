-- WE-R1.3X planning quality: calibrated competency routing, provenance-aware context,
-- competency-specific gap diagnosis and real alternative-plan generation.
-- Additive/non-activating. Runtime execution, heartbeat and Factory remain OFF.

create or replace function public.hq_workforce_rank_workers_by_competency(
  p_competency_keys text[],
  p_scope_type text,
  p_jurisdiction text default 'global',
  p_limit integer default 10
) returns table(worker_key text,matched_competencies integer,fit_score numeric)
language sql
security definer
set search_path=public,pg_temp
stable
as $$
  with latest as (
    select distinct on (c.worker_key,c.competency_key)
      c.worker_key,c.competency_key,c.proficiency,c.reliability,c.certification_status,
      c.allowed_scope_types,c.jurisdictions,c.expires_at
    from public.hq_workforce_worker_competencies c
    where c.competency_key=any(p_competency_keys)
    order by c.worker_key,c.competency_key,c.version desc
  ), scored as (
    select l.worker_key,l.competency_key,
      greatest(0::numeric,least(1::numeric,
        (l.proficiency*0.55)
        +(coalesce(l.reliability,l.proficiency)*0.25)
        +(coalesce(cal.reliability,coalesce(l.reliability,l.proficiency))*0.20)
      )) as score
    from latest l
    left join public.hq_workforce_calibration cal
      on cal.dimension_type='worker' and cal.dimension_key=l.worker_key and cal.sample_count>=3
    where l.certification_status='certified'
      and (l.expires_at is null or l.expires_at>clock_timestamp())
      and (p_scope_type=any(l.allowed_scope_types) or 'global'=any(l.allowed_scope_types))
      and (p_jurisdiction=any(l.jurisdictions) or 'global'=any(l.jurisdictions))
  )
  select s.worker_key,count(distinct s.competency_key)::integer,avg(s.score)::numeric
  from scored s
  group by s.worker_key
  order by count(distinct s.competency_key) desc,avg(s.score) desc,s.worker_key
  limit greatest(1,least(coalesce(p_limit,10),100));
$$;

create or replace function public.hq_workforce_collect_objective_context(
  p_objective_id uuid,
  p_limit integer default 25
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare o public.hq_workforce_objectives%rowtype; lim integer:=greatest(1,least(coalesce(p_limit,25),100)); v_memory jsonb; v_source jsonb;
begin
  select * into o from public.hq_workforce_objectives where id=p_objective_id;
  if not found then raise exception 'objective_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'memory_id',m.id,'memory_key',m.memory_key,'version',m.version,'type',m.memory_type,
    'content',m.content,'provenance',m.provenance,'confidence',m.confidence,
    'authoritative',m.authoritative,'stale',(m.valid_until is not null and m.valid_until<=clock_timestamp()),
    'contradictory',(m.contradiction_group is not null and exists(
      select 1 from public.hq_workforce_memory x
      where x.contradiction_group=m.contradiction_group and x.id<>m.id
        and (x.valid_until is null or x.valid_until>clock_timestamp())
    ))
  ) order by m.authoritative desc,m.confidence desc,m.version desc),'[]'::jsonb)
  into v_memory
  from (
    select m.*
    from public.hq_workforce_memory m
    where (m.scope_type=o.scope_type or m.scope_type='global')
      and (m.scope_key is null or m.scope_key=o.scope_key)
      and (o.jurisdiction=any(m.jurisdictions) or 'global'=any(m.jurisdictions))
      and (m.retention_until is null or m.retention_until>clock_timestamp())
    order by m.authoritative desc,
             (m.valid_until is null or m.valid_until>clock_timestamp()) desc,
             m.confidence desc,m.created_at desc
    limit lim
  ) m;

  v_source:=jsonb_build_object(
    'source_type',o.source_type,'source_ref',o.source_ref,'provenance',o.provenance,
    'success_criteria',o.success_criteria,'evidence_requirements',o.evidence_requirements,
    'desired_outcome',o.desired_outcome,'constraints',o.constraints
  );

  return jsonb_build_object(
    'objective_id',o.id,'source',v_source,'memory',coalesce(v_memory,'[]'::jsonb),
    'context_policy',jsonb_build_object('stale_and_contradictory_exposed',true,'authoritative_preferred',true,'silent_override',false)
  );
end $$;

-- Factory diagnosis is competency-specific. Generic availability of unrelated workers,
-- skills or resources can no longer hide the actual missing capability.
create or replace function public.hq_workforce_diagnose_capability_gap(p_objective_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 o public.hq_workforce_objectives%rowtype; comp text; active_workers int; any_competency int;
 cap_count int; safe_cap_count int; v_diag text:='no_gap'; details jsonb:='[]'::jsonb;
 v_create boolean:=false; v_id uuid;
begin
 select * into o from public.hq_workforce_objectives where id=p_objective_id;
 if not found then raise exception 'objective_not_found'; end if;
 if cardinality(o.required_competencies)=0 then v_diag:='routing_gap';
 else
  foreach comp in array o.required_competencies loop
    select count(*) into active_workers
    from public.hq_workforce_rank_workers_by_competency(array[comp],o.scope_type,o.jurisdiction,100) rw
    join public.hq_workforce_workers w on w.worker_key=rw.worker_key and w.status='active'
    where public.hq_workforce_current_lifecycle_state(rw.worker_key)='active';

    select count(*) into any_competency
    from public.hq_workforce_worker_competencies c
    where c.competency_key=comp and c.certification_status in ('draft','tested','certified')
      and (c.expires_at is null or c.expires_at>clock_timestamp());

    select count(*) into cap_count
    from public.hq_workforce_competency_capabilities b
    join public.hq_workforce_skill_manifests m on m.skill_key=b.skill_key and m.version>=b.min_skill_version
    where b.competency_key=comp and b.status='approved'
      and m.certification_status='certified' and m.shadow_capable and m.autonomy_required=0;

    select count(*) into safe_cap_count
    from public.hq_workforce_resolve_capability_for_competency(comp,o.scope_type,o.jurisdiction);

    details:=details||jsonb_build_array(jsonb_build_object(
      'competency',comp,'active_certified_workers',active_workers,'known_worker_competencies',any_competency,
      'certified_capabilities',cap_count,'safe_resolvable_capabilities',safe_cap_count
    ));

    if safe_cap_count=0 and cap_count>0 then v_diag:='resource_gap'; exit;
    elsif cap_count=0 then v_diag:='skill_gap'; exit;
    elsif active_workers=0 and any_competency>0 then v_diag:='routing_gap'; exit;
    elsif active_workers=0 then v_diag:='worker_gap'; v_create:=true; exit;
    end if;
  end loop;
 end if;

 insert into public.hq_workforce_factory_recommendations(objective_id,diagnosis,evidence,proposed_action,worker_creation_recommended)
 values(o.id,v_diag,jsonb_build_object('required_competencies',o.required_competencies,'coverage',details),
  case v_diag
   when 'resource_gap' then jsonb_build_object('action','register_restore_or_replace_resource')
   when 'skill_gap' then jsonb_build_object('action','propose_and_test_skill_candidate')
   when 'routing_gap' then jsonb_build_object('action','review_or_certify_existing_worker_competency')
   when 'worker_gap' then jsonb_build_object('action','propose_worker_specification_for_human_review')
   else jsonb_build_object('action','use_existing_capability') end,
  v_create) returning id into v_id;

 if v_diag='skill_gap' then
   perform public.hq_workforce_propose_skill_candidate(
     jsonb_build_object('objective_id',o.id,'required_competencies',o.required_competencies,'coverage',details),
     jsonb_build_object('purpose',o.statement,'scope_type',o.scope_type,'autonomy_ceiling',0),
     '[]'::jsonb,'[]'::jsonb);
 end if;
 return jsonb_build_object('recommendation_id',v_id,'diagnosis',v_diag,'coverage',details,
   'worker_creation_recommended',v_create,'factory_execution',false);
end $$;

-- Produce a real alternative only when a second qualified worker exists for at least one
-- competency. It is not synthetic duplication: the alternative must differ in assignment.
create or replace function public.hq_workforce_generate_shadow_plan_alternative(p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 p public.hq_workforce_plans%rowtype; o public.hq_workforce_objectives%rowtype; alt uuid; s record;
 alt_worker text; changed boolean:=false; prev uuid; new_step uuid; dag jsonb; alt_conf numeric:=1;
begin
 select * into p from public.hq_workforce_plans where id=p_plan_id;
 if not found then raise exception 'plan_not_found'; end if;
 select * into o from public.hq_workforce_objectives where id=p.objective_id;
 insert into public.hq_workforce_plans(objective_id,plan_version,strategy_key,status,expected_quality,confidence,required_risk,required_autonomy,estimated_cost,estimated_latency_ms,rationale,verification_contract)
 values(p.objective_id,p.plan_version+1,p.strategy_key||'-alternate-assignment','draft',p.expected_quality,p.confidence,p.required_risk,p.required_autonomy,p.estimated_cost,p.estimated_latency_ms,
        p.rationale||jsonb_build_object('alternative_of',p.id),p.verification_contract) returning id into alt;

 for s in select * from public.hq_workforce_plan_steps where plan_id=p.id order by ordinal loop
   alt_worker:=null;
   select rw.worker_key into alt_worker
   from public.hq_workforce_rank_workers_by_competency(s.required_competencies,o.scope_type,o.jurisdiction,100) rw
   join public.hq_workforce_workers w on w.worker_key=rw.worker_key and w.status='active'
   where public.hq_workforce_current_lifecycle_state(rw.worker_key)='active' and rw.worker_key<>s.worker_key
   order by rw.matched_competencies desc,rw.fit_score desc,rw.worker_key limit 1;
   if alt_worker is null then alt_worker:=s.worker_key; else changed:=true; end if;
   insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,skill_manifest_id,worker_key,required_competencies,input_contract,expected_output,verification_contract,required_risk,required_autonomy,status)
   values(alt,s.step_key,s.ordinal,s.skill_manifest_id,alt_worker,s.required_competencies,s.input_contract,s.expected_output,s.verification_contract,s.required_risk,s.required_autonomy,'planned') returning id into new_step;
   if prev is not null then insert into public.hq_workforce_plan_step_dependencies(plan_id,step_id,depends_on_step_id,dependency_type) values(alt,new_step,prev,'evidence_from'); end if;
   prev:=new_step;
 end loop;

 if not changed then delete from public.hq_workforce_plans where id=alt; return jsonb_build_object('status','not_available','reason','no_distinct_qualified_assignment','source_plan_id',p.id); end if;
 dag:=public.hq_workforce_validate_plan_dag(alt);
 if not coalesce((dag->>'valid')::boolean,false) then update public.hq_workforce_plans set status='rejected' where id=alt; return jsonb_build_object('status','rejected','plan_id',alt,'dag',dag); end if;
 select coalesce(min(rw.fit_score),p.confidence) into alt_conf
 from public.hq_workforce_plan_steps ps
 join lateral public.hq_workforce_rank_workers_by_competency(ps.required_competencies,o.scope_type,o.jurisdiction,100) rw on rw.worker_key=ps.worker_key
 where ps.plan_id=alt;
 update public.hq_workforce_plans set status='simulated',confidence=alt_conf where id=alt;
 return jsonb_build_object('status','simulated','source_plan_id',p.id,'alternative_plan_id',alt,'confidence',alt_conf,'dag',dag);
end $$;

revoke all on function public.hq_workforce_rank_workers_by_competency(text[],text,text,integer),public.hq_workforce_collect_objective_context(uuid,integer),public.hq_workforce_diagnose_capability_gap(uuid),public.hq_workforce_generate_shadow_plan_alternative(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_rank_workers_by_competency(text[],text,text,integer),public.hq_workforce_collect_objective_context(uuid,integer),public.hq_workforce_diagnose_capability_gap(uuid),public.hq_workforce_generate_shadow_plan_alternative(uuid) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'planning_quality_violated_L0_boundary'; end if;
end $$;
