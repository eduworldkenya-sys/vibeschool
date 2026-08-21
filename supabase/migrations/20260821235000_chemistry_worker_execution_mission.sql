begin;

-- Canonicalize the already-implemented Chemistry Critic and governed Repair
-- identities inside Worker Engine. This is non-activating: no scheduler,
-- publication authority, runtime autonomy, or content mutation is enabled.
insert into public.hq_workforce_workers(
  worker_key,worker_kind,title,department_key,mission,status,reasoning_mode,
  paid_ai_allowed,competencies,permissions,approval_boundaries,kpis
) values
('content-critic-chemistry-v1','digital','Independent Senior Chemistry Educational Editor','product',
 'Independently challenge exact-version Chemistry artifacts for curriculum fidelity, scientific correctness, pedagogy, assessment integrity, practical safety, provenance, Kenyan classroom feasibility and rendered usability. Never author, repair, approve or publish the artifact being judged.',
 'restricted','external_ai',true,
 '["chemistry subject review","curriculum judgment","scientific verification","assessment validity","laboratory safety","pedagogical criticism","classroom feasibility","evidence criticism","mobile render review"]'::jsonb,
 '["read_exact_content_candidate","read_curriculum_identity","read_verified_sources","record_independent_findings","recommend_repair_or_pass"]'::jsonb,
 '["no_authoring","no_repair","no_self_certification","no_release_override","no_publication","no_authority_grants","exact_version_only","block_on_uncertainty"]'::jsonb,
 '["critical_defect_recall","false_pass_rate","evidence_sufficiency","assessment_error_recall","safety_error_recall","human_disagreement_rate"]'::jsonb),
('content-repair-chemistry-v1','digital','Senior Chemistry Instructional Remediation Editor','content',
 'Produce the smallest authorized exact-version repair candidate for independently verified Chemistry findings while preserving curriculum identity, correct content, provenance, assessment coherence and release state. Never verify, approve or publish its own repair.',
 'restricted','external_ai',true,
 '["chemistry remediation","root cause repair","curriculum preservation","assessment coherence","laboratory safety","bounded editing","regression avoidance","uncertainty escalation"]'::jsonb,
 '["read_exact_content_candidate","read_independent_findings","read_verified_sources","create_immutable_repair_candidate","record_repair_handoff"]'::jsonb,
 '["repair_candidate_only","no_evaluator_changes","no_finding_waiver","no_curriculum_identity_change","no_release_state_change","no_self_verification","no_publication","bounded_attempts"]'::jsonb,
 '["verified_defect_resolution","regression_escape_rate","protected_section_integrity","repair_convergence","uncertainty_escalation_accuracy"]'::jsonb)
on conflict(worker_key) do update set
 title=excluded.title,department_key=excluded.department_key,mission=excluded.mission,
 reasoning_mode=excluded.reasoning_mode,paid_ai_allowed=excluded.paid_ai_allowed,
 competencies=excluded.competencies,permissions=excluded.permissions,
 approval_boundaries=excluded.approval_boundaries,kpis=excluded.kpis,updated_at=clock_timestamp();

-- Build professional baselines. Certification remains evidence-bound and is not
-- inferred from worker status or Edge Function existence.
select public.hq_workforce_professional_baseline('content-critic-chemistry-v1');
select public.hq_workforce_professional_baseline('content-repair-chemistry-v1');
update public.hq_workforce_worker_assurance set archetype='critic',risk_class='R2'
where worker_key='content-critic-chemistry-v1' and standard_key='vibeschool-professional-worker' and standard_version=1;
update public.hq_workforce_worker_assurance set archetype='repair',risk_class='R2'
where worker_key='content-repair-chemistry-v1' and standard_key='vibeschool-professional-worker' and standard_version=1;

create table if not exists public.chemistry_worker_missions(
 id uuid primary key default gen_random_uuid(),
 mission_key text not null unique,
 publication_id uuid not null references public.vibe_publications(id) on delete restrict,
 mode text not null default 'shadow' check(mode='shadow'),
 state text not null default 'BLOCKED_READINESS' check(state in ('BLOCKED_READINESS','READY','RUNNING','WAITING_HUMAN_REVIEW','COMPLETED','ESCALATED','PAUSED')),
 worker_versions jsonb not null,
 curriculum_scope jsonb not null,
 iteration_budget integer not null default 3 check(iteration_budget between 1 and 3),
 cost_budget jsonb not null default '{"paid_model_calls_per_artifact":6}'::jsonb,
 runtime_posture jsonb not null,
 readiness_findings jsonb not null default '[]'::jsonb,
 started_by uuid references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.chemistry_worker_mission_items(
 id uuid primary key default gen_random_uuid(),
 mission_id uuid not null references public.chemistry_worker_missions(id) on delete restrict,
 chapter_id uuid not null references public.vibe_chapters(id) on delete restrict,
 source_version text not null,
 source_hash text not null,
 stage text not null default 'BLOCKED_READINESS' check(stage in ('BLOCKED_READINESS','AUTHOR_QUEUED','AUTHORING','P2_QUEUED','P2_REVIEW','P3_QUEUED','P3_REVIEW','REPAIR_QUEUED','REPAIRING','FRESH_P2_QUEUED','FRESH_P3_QUEUED','HUMAN_REVIEW','CONVERGED','ESCALATED','PAUSED')),
 iteration integer not null default 0 check(iteration between 0 and 3),
 artifact_version_id uuid references public.content_convergence_versions(id) on delete restrict,
 convergence_run_id uuid references public.content_convergence_runs(id) on delete restrict,
 blocker_codes text[] not null default '{}',
 next_action text not null,
 evidence jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(mission_id,chapter_id)
);

alter table public.chemistry_worker_missions enable row level security;
alter table public.chemistry_worker_mission_items enable row level security;
revoke all on public.chemistry_worker_missions,public.chemistry_worker_mission_items from public,anon,authenticated,service_role;
grant select,insert,update on public.chemistry_worker_missions,public.chemistry_worker_mission_items to service_role;

create or replace function public.hq_start_chemistry_worker_mission(p_publication_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.vibe_publications%rowtype; ec public.hq_workforce_engine_contract%rowtype;
  v_key text; v_id uuid; v_ready boolean:=true; v_findings jsonb:='[]'; v_versions jsonb:='{}'; v_worker_key text; a jsonb;
begin
 perform public.hq_assert_owner();
 select * into p from public.vibe_publications where id=p_publication_id;
 if not found then raise exception 'CHEMISTRY_PUBLICATION_NOT_FOUND'; end if;
 if lower(coalesce(p.cbc_subject,''))<>'chemistry' and lower(coalesce(p.title,'')) not like '%chemistry%' then raise exception 'CHEMISTRY_PUBLICATION_REQUIRED'; end if;
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'MISSION_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON'; end if;
 foreach v_worker_key in array array['content-factory-r2-canary-01','quality-worker-01','content-critic-chemistry-v1','content-repair-chemistry-v1'] loop
   begin a:=public.content_convergence_assert_certified_worker(v_worker_key,null); v_versions:=v_versions||jsonb_build_object(v_worker_key,a);
   exception when others then v_ready:=false; v_findings:=v_findings||jsonb_build_array(jsonb_build_object('worker_key',v_worker_key,'code',sqlerrm)); end;
 end loop;
 if not exists(select 1 from public.vibe_chapters c where c.publication_id=p_publication_id) then
   v_ready:=false; v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','NO_CHAPTERS_FOUND'));
 end if;
 v_key:='chemistry-repair:'||p_publication_id::text||':v1';
 insert into public.chemistry_worker_missions(mission_key,publication_id,state,worker_versions,curriculum_scope,runtime_posture,readiness_findings,started_by)
 values(v_key,p_publication_id,case when v_ready then 'READY' else 'BLOCKED_READINESS' end,v_versions,
   jsonb_build_object('subject','Chemistry','grade',p.cbc_grade,'publication_id',p.id,'all_artifact_types',true,'blast_radius_scan',true),
   jsonb_build_object('runtime_execution_enabled',ec.runtime_execution_enabled,'shadow_enabled',ec.shadow_enabled,'scheduler_enabled',ec.shadow_scheduler_enabled,'global_stop',ec.shadow_global_stop),v_findings,auth.uid())
 on conflict(mission_key) do update set worker_versions=excluded.worker_versions,runtime_posture=excluded.runtime_posture,readiness_findings=excluded.readiness_findings,
   state=case when chemistry_worker_missions.state in ('COMPLETED','RUNNING','WAITING_HUMAN_REVIEW') then chemistry_worker_missions.state else excluded.state end,updated_at=clock_timestamp()
 returning id into v_id;
 insert into public.chemistry_worker_mission_items(mission_id,chapter_id,source_version,source_hash,stage,blocker_codes,next_action,evidence)
 select v_id,c.id,concat('chapter:',c.id,':updated:',c.updated_at),encode(digest(coalesce(c.blocks,'[]'::jsonb)::text,'sha256'),'hex'),
   case when v_ready then 'AUTHOR_QUEUED' else 'BLOCKED_READINESS' end,
   case when v_ready then '{}'::text[] else array(select x->>'code' from jsonb_array_elements(v_findings) x where x ? 'code') end,
   case when v_ready then 'Create a fresh immutable certified-author draft from locked curriculum and evidence.' else 'Complete fresh independent certification for every required worker.' end,
   jsonb_build_object('chapter_title',c.title,'learning_outcomes',c.learning_outcomes,'strand',c.cbc_strand,'negative_control_hash',encode(digest(coalesce(c.blocks,'[]'::jsonb)::text,'sha256'),'hex'),'publication_state',p.status)
 from public.vibe_chapters c where c.publication_id=p_publication_id
 on conflict(mission_id,chapter_id) do nothing;
 return public.hq_get_chemistry_worker_mission(v_id);
end $$;

create or replace function public.hq_get_chemistry_worker_mission(p_mission_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v jsonb;
begin
 perform public.hq_assert_owner();
 select jsonb_build_object('mission',to_jsonb(m),'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from public.chemistry_worker_mission_items i where i.mission_id=m.id),'[]'::jsonb)) into v
 from public.chemistry_worker_missions m where m.id=p_mission_id;
 return v;
end $$;

create or replace function public.hq_list_chemistry_worker_missions(p_limit integer default 20)
returns setof public.chemistry_worker_missions language plpgsql stable security definer set search_path=public,pg_temp as $$
begin perform public.hq_assert_owner(); return query select * from public.chemistry_worker_missions order by created_at desc limit greatest(1,least(coalesce(p_limit,20),100)); end $$;

revoke all on function public.hq_start_chemistry_worker_mission(uuid),public.hq_get_chemistry_worker_mission(uuid),public.hq_list_chemistry_worker_missions(integer) from public,anon;
grant execute on function public.hq_start_chemistry_worker_mission(uuid),public.hq_get_chemistry_worker_mission(uuid),public.hq_list_chemistry_worker_missions(integer) to authenticated,service_role;

commit;
