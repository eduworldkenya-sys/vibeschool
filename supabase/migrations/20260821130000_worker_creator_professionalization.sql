-- Worker Creator professionalization. Additive governance only.
-- Does not activate the factory, heartbeat, workers, or consequential authority.
-- access: service-only public.hq_workforce_professional_standards
-- authorization-test: public.hq_workforce_professional_standards anon/authenticated denied; service_role only.
-- access: service-only public.hq_workforce_worker_assurance
-- authorization-test: public.hq_workforce_worker_assurance anon/authenticated denied; service_role only.

create table if not exists public.hq_workforce_professional_standards (
  standard_key text not null,
  version integer not null check (version > 0),
  standard jsonb not null,
  status text not null default 'approved' check (status in ('draft','approved','retired')),
  approved_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  primary key (standard_key, version)
);

create table if not exists public.hq_workforce_worker_assurance (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  standard_key text not null,
  standard_version integer not null,
  archetype text not null,
  risk_class text not null check (risk_class in ('R0','R1','R2','R3')),
  competency_profile jsonb not null default '{}'::jsonb,
  required_skills jsonb not null default '[]'::jsonb,
  context_contract jsonb not null default '{}'::jsonb,
  memory_contract jsonb not null default '{}'::jsonb,
  guardrails jsonb not null default '{}'::jsonb,
  assurance_contract jsonb not null default '{}'::jsonb,
  assessment jsonb not null default '{}'::jsonb,
  certification_state text not null default 'UNASSESSED' check (certification_state in ('UNASSESSED','PROVISIONAL','NEEDS_REPAIR','CERTIFIED','SUSPENDED','REVOKED')),
  legacy_recertification_required boolean not null default true,
  assessed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(worker_key, standard_key, standard_version),
  foreign key (standard_key, standard_version) references public.hq_workforce_professional_standards(standard_key, version) on delete restrict
);

alter table public.hq_workforce_professional_standards enable row level security;
alter table public.hq_workforce_worker_assurance enable row level security;
revoke all on table public.hq_workforce_professional_standards, public.hq_workforce_worker_assurance from public, anon, authenticated, service_role;
grant select, insert, update on table public.hq_workforce_professional_standards, public.hq_workforce_worker_assurance to service_role;

insert into public.hq_workforce_professional_standards(standard_key,version,standard,status,approved_at)
values ('vibeschool-professional-worker',1,jsonb_build_object(
  'competence_does_not_imply_authority',true,
  'independent_assurance_required',true,
  'creation_does_not_grant_authority',true,
  'global_stop_required',true,
  'legacy_recertification_required',true,
  'risk_classes',jsonb_build_array('R0','R1','R2','R3'),
  'required_dimensions',jsonb_build_array('identity','mission_boundaries','archetype','competency_profile','certified_skills','context_contract','memory_contract','tool_contracts','risk_class','guardrails','failure_semantics','independent_assurance','adversarial_evidence','provenance','shadow_evidence','canary_evidence','runtime_telemetry','recertification')
),'approved',clock_timestamp())
on conflict (standard_key,version) do nothing;

create or replace function public.hq_workforce_creator_assess_worker(p_worker_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.hq_workforce_workers%rowtype; v_missing jsonb := '[]'::jsonb; v_risk text; v_state text; v_id uuid;
begin
  select * into w from public.hq_workforce_workers where worker_key=p_worker_key;
  if not found then raise exception 'worker_not_found'; end if;
  if coalesce(trim(w.mission),'')='' then v_missing:=v_missing||'"mission"'::jsonb; end if;
  if coalesce(jsonb_array_length(coalesce(w.competencies,'[]'::jsonb)),0)=0 then v_missing:=v_missing||'"competency_profile"'::jsonb; end if;
  if coalesce(jsonb_array_length(coalesce(w.permissions,'[]'::jsonb)),0)=0 then v_missing:=v_missing||'"bounded_permissions"'::jsonb; end if;
  v_risk := case when w.department_key in ('finance','security') then 'R3' when w.department_key in ('publishing','operations') then 'R2' else 'R1' end;
  v_state := case when jsonb_array_length(v_missing)=0 then 'PROVISIONAL' else 'NEEDS_REPAIR' end;
  insert into public.hq_workforce_worker_assurance(worker_key,standard_key,standard_version,archetype,risk_class,competency_profile,required_skills,context_contract,memory_contract,guardrails,assurance_contract,assessment,certification_state,legacy_recertification_required,assessed_at)
  values(w.worker_key,'vibeschool-professional-worker',1,
    case when w.department_key='finance' then 'finance' when w.department_key='security' then 'security_sensitive' when w.department_key='support' then 'support' when w.department_key='publishing' then 'operational' when w.department_key='content' then 'author' else 'operational' end,
    v_risk,jsonb_build_object('declared',coalesce(w.competencies,'[]'::jsonb)),'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,
    jsonb_build_object('least_privilege_required',true,'global_stop_required',true,'creation_does_not_grant_authority',true),
    jsonb_build_object('independent_assurance_required',true,'adversarial_evidence_required',true,'fresh_verification_after_repair',true),
    jsonb_build_object('missing_dimensions',v_missing,'existing_status',w.status,'reasoning_mode',w.reasoning_mode),v_state,true,clock_timestamp())
  on conflict(worker_key,standard_key,standard_version) do update set risk_class=excluded.risk_class, assessment=excluded.assessment, certification_state=excluded.certification_state, assessed_at=excluded.assessed_at
  returning id into v_id;
  return jsonb_build_object('assurance_id',v_id,'worker_key',w.worker_key,'risk_class',v_risk,'state',v_state,'missing_dimensions',v_missing,'authority_changed',false);
end $$;

revoke all on function public.hq_workforce_creator_assess_worker(text) from public,anon,authenticated;
grant execute on function public.hq_workforce_creator_assess_worker(text) to service_role;

-- Seed legacy fleet as explicitly requiring recertification; no worker status/authority is changed.
insert into public.hq_workforce_worker_assurance(worker_key,standard_key,standard_version,archetype,risk_class,certification_state,legacy_recertification_required,assessment)
select w.worker_key,'vibeschool-professional-worker',1,
  case when w.department_key='finance' then 'finance' when w.department_key='security' then 'security_sensitive' when w.department_key='support' then 'support' when w.department_key='content' then 'author' else 'operational' end,
  case when w.department_key in ('finance','security') then 'R3' when w.department_key in ('publishing','operations') then 'R2' else 'R1' end,
  'UNASSESSED',true,jsonb_build_object('legacy_fleet',true,'existing_status',w.status)
from public.hq_workforce_workers w
on conflict(worker_key,standard_key,standard_version) do nothing;
