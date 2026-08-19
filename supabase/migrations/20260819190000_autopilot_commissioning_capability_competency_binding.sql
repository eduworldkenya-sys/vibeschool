-- Autopilot commissioning: close certified capability -> worker competency routing gap.
-- NON-ACTIVATING. This migration only tightens qualification/routing semantics.
-- It creates no worker, identity, certification, grant, runtime policy, budget, task,
-- execution intent, or side effect, and it does not release Global Stop.

insert into public.hq_workforce_capability_competencies(
  capability_id, competency_key, required, weight, minimum_proficiency
)
select c.id, v.competency_key, true, v.weight, v.minimum_proficiency
from public.hq_workforce_capabilities c
join (values
  ('content.research.execute', 1, 'curriculum.analysis', 1.00::numeric, 0.90::numeric),
  ('content.evidence.semantic_verify', 1, 'quality.analysis', 1.00::numeric, 0.90::numeric),
  ('content.authoring.source_grounded', 1, 'curriculum.analysis', 0.60::numeric, 0.90::numeric),
  ('content.authoring.source_grounded', 1, 'content.quality', 0.40::numeric, 0.90::numeric)
) as v(capability_key, version, competency_key, weight, minimum_proficiency)
  on c.capability_key=v.capability_key and c.version=v.version
where c.lifecycle_status='certified'
on conflict(capability_id,competency_key) do update set
  required=excluded.required,
  weight=excluded.weight,
  minimum_proficiency=excluded.minimum_proficiency;

do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_missing integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'autopilot_competency_binding_requires_engine_contract'; end if;

  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'autopilot_competency_binding_changed_fail_closed_posture';
  end if;

  if exists(select 1 from public.hq_workforce_capability_authority_grants where status='active') then
    raise exception 'autopilot_competency_binding_activated_authority';
  end if;

  select count(*) into v_missing
  from public.hq_workforce_capabilities c
  where c.capability_key in (
    'content.research.execute',
    'content.evidence.semantic_verify',
    'content.authoring.source_grounded'
  )
    and c.version=1
    and c.lifecycle_status='certified'
    and not exists(
      select 1
      from public.hq_workforce_capability_competencies cc
      where cc.capability_id=c.id
        and cc.required
    );

  if v_missing<>0 then
    raise exception 'autopilot_certified_capability_missing_competency_contract:%',v_missing;
  end if;
end $$;
