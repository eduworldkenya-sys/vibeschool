-- Evidence-backed Worker Creator qualification closure. No activation or authority grants.
-- access: service-only public.hq_workforce_qualification_evidence
-- authorization-test: public.hq_workforce_qualification_evidence anon/authenticated denied; service_role select/insert only.
create table if not exists public.hq_workforce_qualification_evidence (
 id uuid primary key default gen_random_uuid(), worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
 worker_version text not null, standard_key text not null default 'vibeschool-professional-worker', standard_version integer not null default 1,
 evidence_kind text not null check(evidence_kind in ('baseline','independent','adversarial','repair','reverification','shadow','canary','human_authority','global_stop','authority_separation','drift')),
 evaluator_key text not null, suite_version text not null, passed boolean not null, evidence jsonb not null default '{}'::jsonb,
 supersedes_id uuid references public.hq_workforce_qualification_evidence(id) on delete restrict, created_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_wq_evidence_worker_idx on public.hq_workforce_qualification_evidence(worker_key,created_at desc);
alter table public.hq_workforce_qualification_evidence enable row level security;
revoke all on table public.hq_workforce_qualification_evidence from public,anon,authenticated,service_role;
grant select,insert on table public.hq_workforce_qualification_evidence to service_role;

alter table public.hq_workforce_worker_assurance add column if not exists qualification_state text not null default 'UNASSESSED';
alter table public.hq_workforce_worker_assurance add column if not exists worker_version text;
alter table public.hq_workforce_worker_assurance add column if not exists certified_at timestamptz;
alter table public.hq_workforce_worker_assurance add column if not exists certification_evidence_ids uuid[] not null default '{}';

create or replace function public.hq_workforce_professional_baseline(p_worker_key text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.hq_workforce_workers%rowtype; v_risk text; v_arch text; v_ver text;
begin
 select * into w from public.hq_workforce_workers where worker_key=p_worker_key; if not found then raise exception 'worker_not_found'; end if;
 v_risk:=case when w.department_key in ('finance','security') then 'R3' when w.department_key in ('publishing','operations','platform') then 'R2' else 'R1' end;
 v_arch:=case when w.department_key='finance' then 'finance' when w.department_key='security' then 'security_sensitive' when w.department_key='support' then 'support' when w.department_key='content' then 'author' when w.department_key='product' then 'critic' else 'operational' end;
 v_ver:=md5(concat_ws('|',w.worker_key,w.mission,w.competencies::text,w.permissions::text,w.reasoning_mode));
 insert into public.hq_workforce_worker_assurance(worker_key,standard_key,standard_version,archetype,risk_class,competency_profile,required_skills,context_contract,memory_contract,guardrails,assurance_contract,assessment,certification_state,legacy_recertification_required,assessed_at,qualification_state,worker_version)
 values(w.worker_key,'vibeschool-professional-worker',1,v_arch,v_risk,jsonb_build_object('declared',coalesce(w.competencies,'[]'::jsonb)),coalesce(w.competencies,'[]'::jsonb),jsonb_build_object('scope','worker_and_authorized_lane','cross_lane','deny'),jsonb_build_object('scope','worker','retention','governed'),jsonb_build_object('least_privilege_required',true,'global_stop_required',true,'creation_does_not_grant_authority',true,'fail_closed',true),jsonb_build_object('independent_assurance_required',true,'adversarial_evidence_required',true,'fresh_verification_after_repair',true,'creator_may_self_certify',false),jsonb_build_object('professional_dimensions_complete',coalesce(trim(w.mission),'')<>'' and jsonb_array_length(coalesce(w.competencies,'[]'::jsonb))>0 and jsonb_array_length(coalesce(w.permissions,'[]'::jsonb))>0),'PROVISIONAL',true,clock_timestamp(),'BASELINE_READY',v_ver)
 on conflict(worker_key,standard_key,standard_version) do update set archetype=excluded.archetype,risk_class=excluded.risk_class,competency_profile=excluded.competency_profile,required_skills=excluded.required_skills,context_contract=excluded.context_contract,memory_contract=excluded.memory_contract,guardrails=excluded.guardrails,assurance_contract=excluded.assurance_contract,assessment=excluded.assessment,assessed_at=excluded.assessed_at,worker_version=excluded.worker_version,qualification_state=case when hq_workforce_worker_assurance.worker_version is distinct from excluded.worker_version then 'UNASSESSED' else hq_workforce_worker_assurance.qualification_state end,certification_state=case when hq_workforce_worker_assurance.worker_version is distinct from excluded.worker_version then 'SUSPENDED' else hq_workforce_worker_assurance.certification_state end;
 return jsonb_build_object('worker_key',w.worker_key,'worker_version',v_ver,'archetype',v_arch,'risk_class',v_risk,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_professional_baseline(text) from public,anon,authenticated; grant execute on function public.hq_workforce_professional_baseline(text) to service_role;

create or replace function public.hq_workforce_record_qualification_evidence(p_worker_key text,p_kind text,p_evaluator text,p_suite text,p_passed boolean,p_evidence jsonb default '{}'::jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.hq_workforce_worker_assurance%rowtype; v_id uuid;
begin
 select * into a from public.hq_workforce_worker_assurance where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1;
 if not found then perform public.hq_workforce_professional_baseline(p_worker_key); select * into a from public.hq_workforce_worker_assurance where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1; end if;
 if p_kind in ('independent','adversarial','reverification','shadow','canary','human_authority') and p_evaluator=p_worker_key then raise exception 'independent_evaluator_required'; end if;
 if p_kind not in ('baseline','independent','adversarial','repair','reverification','shadow','canary','human_authority','global_stop','authority_separation','drift') then raise exception 'invalid_evidence_kind'; end if;
 insert into public.hq_workforce_qualification_evidence(worker_key,worker_version,evidence_kind,evaluator_key,suite_version,passed,evidence) values(p_worker_key,a.worker_version,p_kind,p_evaluator,p_suite,p_passed,coalesce(p_evidence,'{}'::jsonb)) returning id into v_id; return v_id;
end $$;
revoke all on function public.hq_workforce_record_qualification_evidence(text,text,text,text,boolean,jsonb) from public,anon,authenticated; grant execute on function public.hq_workforce_record_qualification_evidence(text,text,text,text,boolean,jsonb) to service_role;

create or replace function public.hq_workforce_decide_professional_certification(p_worker_key text,p_decider text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.hq_workforce_worker_assurance%rowtype; v_latest_repair timestamptz; v_ids uuid[]; v_ok boolean; v_need text[]:='{}';
begin
 select * into a from public.hq_workforce_worker_assurance where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1 for update; if not found then raise exception 'professional_baseline_required'; end if;
 if p_decider=p_worker_key or coalesce(trim(p_decider),'')='' or p_decider ilike '%creator%' then raise exception 'creator_or_self_certification_forbidden'; end if;
 select max(created_at) into v_latest_repair from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='repair';
 if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='independent' and passed) then v_need:=array_append(v_need,'independent'); end if;
 if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='adversarial' and passed) then v_need:=array_append(v_need,'adversarial'); end if;
 if v_latest_repair is not null and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='reverification' and passed and created_at>v_latest_repair) then v_need:=array_append(v_need,'fresh_reverification'); end if;
 if a.risk_class in ('R1','R2','R3') and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='shadow' and passed) then v_need:=array_append(v_need,'shadow'); end if;
 if a.risk_class in ('R2','R3') and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='canary' and passed) then v_need:=array_append(v_need,'canary'); end if;
 if a.risk_class='R3' and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='human_authority' and passed) then v_need:=array_append(v_need,'human_authority'); end if;
 if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='global_stop' and passed) then v_need:=array_append(v_need,'global_stop'); end if;
 if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='authority_separation' and passed) then v_need:=array_append(v_need,'authority_separation'); end if;
 v_ok:=coalesce(array_length(v_need,1),0)=0;
 select coalesce(array_agg(id order by created_at),'{}') into v_ids from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and passed;
 update public.hq_workforce_worker_assurance set certification_state=case when v_ok then 'CERTIFIED' else 'NEEDS_REPAIR' end,qualification_state=case when v_ok then 'CERTIFIED' else 'FAILED_QUALIFICATION' end,legacy_recertification_required=not v_ok,certified_at=case when v_ok then clock_timestamp() else null end,expires_at=case when v_ok then clock_timestamp()+interval '30 days' else null end,certification_evidence_ids=v_ids where id=a.id;
 return jsonb_build_object('worker_key',p_worker_key,'certified',v_ok,'missing_evidence',v_need,'authority_changed',false,'evidence_ids',v_ids);
end $$;
revoke all on function public.hq_workforce_decide_professional_certification(text,text) from public,anon,authenticated; grant execute on function public.hq_workforce_decide_professional_certification(text,text) to service_role;

do $$ declare r record; begin for r in select worker_key from public.hq_workforce_workers loop perform public.hq_workforce_professional_baseline(r.worker_key); end loop; end $$;
