-- Priority 2: professional Quality Worker. Governance/evaluation only; no runtime activation or authority grants.
create table if not exists public.hq_workforce_quality_examinations (
 id uuid primary key default gen_random_uuid(), target_worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
 target_worker_version text not null, quality_worker_key text not null default 'quality-worker-01', quality_worker_version text not null,
 suite_version text not null, standard_key text not null default 'vibeschool-professional-worker', standard_version integer not null default 1,
 evidence_provenance jsonb not null default '{}'::jsonb, recommendation text not null check(recommendation in ('NEEDS_REPAIR','PROVISIONAL','CERTIFIED','SUSPENDED','REVOKED')),
 passed boolean not null, created_at timestamptz not null default clock_timestamp()
);
create table if not exists public.hq_workforce_quality_findings (
 id uuid primary key default gen_random_uuid(), examination_id uuid not null references public.hq_workforce_quality_examinations(id) on delete restrict,
 finding_key text not null, dimension text not null, severity text not null check(severity in ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
 state text not null default 'OPEN' check(state in ('OPEN','ACKNOWLEDGED','REPAIRING','READY_FOR_RETEST','VERIFIED','CLOSED')),
 expected_contract jsonb not null default '{}'::jsonb, observed_behavior jsonb not null default '{}'::jsonb, evidence jsonb not null default '{}'::jsonb,
 remediation_requirement text not null, verification_requirement text not null, created_at timestamptz not null default clock_timestamp(), verified_at timestamptz,
 unique(examination_id,finding_key)
);
create table if not exists public.hq_workforce_quality_fixture_results (
 id uuid primary key default gen_random_uuid(), fixture_key text not null, suite_version text not null, expected_defects text[] not null,
 detected_defects text[] not null, false_positives text[] not null default '{}', passed boolean not null, evidence jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.hq_workforce_quality_examinations enable row level security;
alter table public.hq_workforce_quality_findings enable row level security;
alter table public.hq_workforce_quality_fixture_results enable row level security;
revoke all on table public.hq_workforce_quality_examinations,public.hq_workforce_quality_findings,public.hq_workforce_quality_fixture_results from public,anon,authenticated,service_role;
grant select,insert on public.hq_workforce_quality_examinations,public.hq_workforce_quality_findings,public.hq_workforce_quality_fixture_results to service_role;
grant update(state,verified_at) on public.hq_workforce_quality_findings to service_role;

update public.hq_workforce_workers set
 mission='Independently examine workforce competence, skills, context, memory, tools, authority, evidence, outputs, failures, Global Stop, repairs, shadow/canary behavior, regressions and drift; issue reproducible assurance findings without granting authority or self-certifying.',
 competencies='["professional assurance","skill verification","evidence provenance","authority separation","context and memory isolation","adversarial evaluation","failure semantics","global stop verification","shadow and canary evaluation","regression and drift detection","repair reverification"]'::jsonb,
 permissions='["read_quality_signals","read_worker_professional_profiles","read_worker_assurance_evidence","record_findings","record_examinations","verify_outcomes","verify_repairs","recommend_certification_state","request_approval"]'::jsonb,
 approval_boundaries='["no_destructive_actions","no_release_override","no_self_certification","no_authority_grants","no_permission_widening","no_worker_activation","no_worker_commissioning","no_repair_of_current_exam_target"]'::jsonb,
 kpis='["defect_recall","false_positive_rate","severity_accuracy","evidence_sufficiency","repair_reverification_rate","regression_escape_rate","cross_archetype_accuracy"]'::jsonb,
 updated_at=clock_timestamp() where worker_key='quality-worker-01';

-- Supersede stale v1 assignment with already-certified v2 skill; no new authority is granted.
update public.hq_workforce_worker_skills ws set status='retired'
from public.hq_workforce_workers w, public.hq_workforce_skills s
where ws.worker_id=w.id and ws.skill_id=s.id and w.worker_key='quality-worker-01' and s.skill_key='verify-outcome' and s.version=1 and ws.status<>'retired';
insert into public.hq_workforce_worker_skills(worker_id,skill_id,status,assigned_at,certified_at)
select w.id,s.id,'certified',clock_timestamp(),clock_timestamp() from public.hq_workforce_workers w join public.hq_workforce_skills s on s.skill_key='verify-outcome' and s.version=2 and s.status='certified'
where w.worker_key='quality-worker-01' and not exists(select 1 from public.hq_workforce_worker_skills x where x.worker_id=w.id and x.skill_id=s.id);

create or replace function public.hq_workforce_quality_record_fixture(p_fixture text,p_suite text,p_expected text[],p_detected text[],p_false_positive text[] default '{}',p_evidence jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$ declare v_pass boolean; v_id uuid; begin
 v_pass := p_expected <@ p_detected and coalesce(array_length(p_false_positive,1),0)=0;
 insert into public.hq_workforce_quality_fixture_results(fixture_key,suite_version,expected_defects,detected_defects,false_positives,passed,evidence)
 values(p_fixture,p_suite,p_expected,p_detected,coalesce(p_false_positive,'{}'),v_pass,coalesce(p_evidence,'{}')) returning id into v_id;
 return jsonb_build_object('id',v_id,'passed',v_pass,'fixture_key',p_fixture);
end $$;
revoke all on function public.hq_workforce_quality_record_fixture(text,text,text[],text[],text[],jsonb) from public,anon,authenticated; grant execute on function public.hq_workforce_quality_record_fixture(text,text,text[],text[],text[],jsonb) to service_role;

create or replace function public.hq_workforce_quality_certification_readiness() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.hq_workforce_worker_assurance%rowtype; v_missing text[]:='{}'; v_fixture_total int; v_fixture_pass int; begin
 select * into a from public.hq_workforce_worker_assurance where worker_key='quality-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
 if not found then v_missing:=array_append(v_missing,'professional_baseline'); end if;
 select count(*),count(*) filter(where passed) into v_fixture_total,v_fixture_pass from public.hq_workforce_quality_fixture_results where suite_version='quality-adversarial-v1';
 if v_fixture_total<25 or v_fixture_pass<>v_fixture_total then v_missing:=array_append(v_missing,'defective_worker_laboratory'); end if;
 if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='independent' and passed) then v_missing:=array_append(v_missing,'independent'); end if;
 if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='adversarial' and passed) then v_missing:=array_append(v_missing,'adversarial'); end if;
 if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='shadow' and passed) then v_missing:=array_append(v_missing,'shadow'); end if;
 if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='global_stop' and passed) then v_missing:=array_append(v_missing,'global_stop'); end if;
 if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='authority_separation' and passed) then v_missing:=array_append(v_missing,'authority_separation'); end if;
 return jsonb_build_object('ready',coalesce(array_length(v_missing,1),0)=0,'missing',v_missing,'fixture_total',v_fixture_total,'fixture_pass',v_fixture_pass,'authority_changed',false);
end $$;
revoke all on function public.hq_workforce_quality_certification_readiness() from public,anon,authenticated; grant execute on function public.hq_workforce_quality_certification_readiness() to service_role;

-- Refresh professional version; any prior certification/evidence becomes stale by design.
select public.hq_workforce_professional_baseline('quality-worker-01');
