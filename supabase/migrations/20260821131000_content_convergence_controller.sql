-- Priority 5: closed-loop content convergence controller.
-- Service-only orchestration. No publication authority is granted here.

create table if not exists public.content_convergence_versions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  parent_version_id uuid references public.content_convergence_versions(id),
  revision_id uuid references public.publication_revisions(id),
  version_number integer not null check (version_number > 0),
  content_hash text not null check (length(content_hash) >= 32),
  content_snapshot jsonb not null default '{}'::jsonb,
  worker_key text not null,
  worker_execution_id text,
  repair_reasons jsonb not null default '[]'::jsonb,
  findings_addressed jsonb not null default '[]'::jsonb,
  findings_preserved jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  curriculum_identity jsonb not null default '{}'::jsonb,
  evaluation_lineage jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(publication_id, version_number),
  unique(publication_id, content_hash)
);

create table if not exists public.content_convergence_runs (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  current_version_id uuid not null references public.content_convergence_versions(id),
  state text not null check (state in ('DRAFT','AUTHORED','MEASURING','MEASURED','CRITIC_REVIEW','REPAIR_REQUIRED','REPAIRING','REPAIRED','REVERIFYING','CONVERGED','ESCALATED','RELEASE_CANDIDATE','RELEASE_APPROVED','PUBLISHED','REJECTED','SUPERSEDED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  idempotency_key text not null unique,
  mode text not null default 'shadow' check (mode in ('shadow','draft_canary','release_candidate')),
  lease_owner text,
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
  decision_reason text,
  failure_code text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_convergence_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.content_convergence_runs(id) on delete cascade,
  introduced_version_id uuid not null references public.content_convergence_versions(id),
  current_version_id uuid not null references public.content_convergence_versions(id),
  finding_key text not null,
  critic_execution_id text not null,
  severity text not null check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  defect_type text not null,
  state text not null check (state in ('OPEN','REPAIR_REQUESTED','REPAIR_ATTEMPTED','REVERIFYING','VERIFIED_RESOLVED','STILL_PRESENT','REGRESSED','SUPERSEDED','ESCALATED')),
  evidence jsonb not null default '{}'::jsonb,
  repair_attempts integer not null default 0 check (repair_attempts >= 0),
  last_repair_execution_id text,
  verified_by_execution_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, finding_key, introduced_version_id)
);

create table if not exists public.content_convergence_evaluations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.content_convergence_runs(id) on delete cascade,
  version_id uuid not null references public.content_convergence_versions(id) on delete cascade,
  stage text not null check (stage in ('P2','P3')),
  worker_execution_id text not null,
  content_hash text not null,
  disposition text not null check (disposition in ('PASS','FAIL','ESCALATE','ERROR')),
  quality_score numeric,
  dimensions jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  safety_status text not null default 'UNKNOWN',
  assessment_status text not null default 'UNKNOWN',
  provenance_status text not null default 'UNKNOWN',
  created_at timestamptz not null default now(),
  unique(run_id, version_id, stage, worker_execution_id)
);

create table if not exists public.content_convergence_deltas (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.content_convergence_runs(id) on delete cascade,
  from_version_id uuid not null references public.content_convergence_versions(id),
  to_version_id uuid not null references public.content_convergence_versions(id),
  resolved_findings jsonb not null default '[]'::jsonb,
  remaining_findings jsonb not null default '[]'::jsonb,
  new_findings jsonb not null default '[]'::jsonb,
  regressions jsonb not null default '[]'::jsonb,
  improved_dimensions jsonb not null default '{}'::jsonb,
  worsened_dimensions jsonb not null default '{}'::jsonb,
  unchanged_dimensions jsonb not null default '{}'::jsonb,
  severe_regression boolean not null default false,
  measurable_improvement boolean not null default false,
  created_at timestamptz not null default now(),
  unique(run_id, from_version_id, to_version_id)
);

create table if not exists public.content_convergence_release_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.content_convergence_runs(id) on delete cascade,
  version_id uuid not null references public.content_convergence_versions(id),
  content_hash text not null,
  decision text not null check (decision in ('NOT_READY','HUMAN_REVIEW_REQUIRED','RELEASE_CANDIDATE')),
  reason text not null,
  evidence_packet jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(run_id, version_id, content_hash)
);

create table if not exists public.content_convergence_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.content_convergence_runs(id) on delete cascade,
  from_state text,
  to_state text not null,
  actor text not null,
  execution_id text,
  artifact_version_id uuid references public.content_convergence_versions(id),
  artifact_hash text,
  reason text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.content_convergence_versions enable row level security;
alter table public.content_convergence_runs enable row level security;
alter table public.content_convergence_findings enable row level security;
alter table public.content_convergence_evaluations enable row level security;
alter table public.content_convergence_deltas enable row level security;
alter table public.content_convergence_release_decisions enable row level security;
alter table public.content_convergence_events enable row level security;

revoke all on table public.content_convergence_versions from public, anon, authenticated;
revoke all on table public.content_convergence_runs from public, anon, authenticated;
revoke all on table public.content_convergence_findings from public, anon, authenticated;
revoke all on table public.content_convergence_evaluations from public, anon, authenticated;
revoke all on table public.content_convergence_deltas from public, anon, authenticated;
revoke all on table public.content_convergence_release_decisions from public, anon, authenticated;
revoke all on table public.content_convergence_events from public, anon, authenticated;
grant all on table public.content_convergence_versions to service_role;
grant all on table public.content_convergence_runs to service_role;
grant all on table public.content_convergence_findings to service_role;
grant all on table public.content_convergence_evaluations to service_role;
grant all on table public.content_convergence_deltas to service_role;
grant all on table public.content_convergence_release_decisions to service_role;
grant all on table public.content_convergence_events to service_role;

create or replace function public.content_convergence_transition(p_run_id uuid,p_expected_state text,p_to_state text,p_expected_version_id uuid,p_expected_hash text,p_actor text,p_execution_id text default null,p_reason text default null,p_evidence jsonb default '{}'::jsonb)
returns public.content_convergence_runs language plpgsql security definer set search_path = '' as $$
declare v_run public.content_convergence_runs; v_hash text; v_allowed boolean := false;
begin
  select * into v_run from public.content_convergence_runs where id=p_run_id for update;
  if not found then raise exception 'CONVERGENCE_RUN_NOT_FOUND'; end if;
  if v_run.state <> p_expected_state then raise exception 'STALE_CONVERGENCE_STATE'; end if;
  if v_run.current_version_id <> p_expected_version_id then raise exception 'STALE_ARTIFACT_VERSION'; end if;
  select content_hash into v_hash from public.content_convergence_versions where id=p_expected_version_id;
  if v_hash is distinct from p_expected_hash then raise exception 'STALE_ARTIFACT_HASH'; end if;
  v_allowed := case
    when p_expected_state='DRAFT' and p_to_state='AUTHORED' then true
    when p_expected_state='AUTHORED' and p_to_state='MEASURING' then true
    when p_expected_state='MEASURING' and p_to_state in ('MEASURED','ESCALATED') then true
    when p_expected_state='MEASURED' and p_to_state='CRITIC_REVIEW' then true
    when p_expected_state='CRITIC_REVIEW' and p_to_state in ('REPAIR_REQUIRED','CONVERGED','ESCALATED','REJECTED') then true
    when p_expected_state='REPAIR_REQUIRED' and p_to_state in ('REPAIRING','ESCALATED','REJECTED') then true
    when p_expected_state='REPAIRING' and p_to_state in ('REPAIRED','ESCALATED') then true
    when p_expected_state='REPAIRED' and p_to_state='REVERIFYING' then true
    when p_expected_state='REVERIFYING' and p_to_state in ('REPAIR_REQUIRED','CONVERGED','ESCALATED','REJECTED') then true
    when p_expected_state='CONVERGED' and p_to_state in ('RELEASE_CANDIDATE','ESCALATED','REJECTED') then true
    when p_expected_state='RELEASE_CANDIDATE' and p_to_state in ('RELEASE_APPROVED','ESCALATED','REJECTED','SUPERSEDED') then true
    when p_expected_state='RELEASE_APPROVED' and p_to_state in ('PUBLISHED','SUPERSEDED') then true
    else false end;
  if not v_allowed then raise exception 'ILLEGAL_CONVERGENCE_TRANSITION:%->%', p_expected_state, p_to_state; end if;
  update public.content_convergence_runs set state=p_to_state,decision_reason=p_reason,updated_at=now() where id=p_run_id returning * into v_run;
  insert into public.content_convergence_events(run_id,from_state,to_state,actor,execution_id,artifact_version_id,artifact_hash,reason,evidence)
  values(p_run_id,p_expected_state,p_to_state,p_actor,p_execution_id,p_expected_version_id,p_expected_hash,p_reason,coalesce(p_evidence,'{}'::jsonb));
  return v_run;
end $$;

create or replace function public.content_convergence_create_repair_version(p_run_id uuid,p_parent_version_id uuid,p_parent_hash text,p_content_hash text,p_content_snapshot jsonb,p_worker_key text,p_worker_execution_id text,p_repair_reasons jsonb,p_findings_addressed jsonb,p_findings_preserved jsonb,p_provenance jsonb,p_curriculum_identity jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_run public.content_convergence_runs; v_parent public.content_convergence_versions; v_new_id uuid;
begin
  select * into v_run from public.content_convergence_runs where id=p_run_id for update;
  if not found then raise exception 'CONVERGENCE_RUN_NOT_FOUND'; end if;
  if v_run.state <> 'REPAIRING' then raise exception 'REPAIR_NOT_AUTHORIZED_IN_STATE'; end if;
  if v_run.current_version_id <> p_parent_version_id then raise exception 'STALE_REPAIR_VERSION'; end if;
  if v_run.attempt_count >= v_run.max_attempts then raise exception 'REPAIR_ATTEMPT_LIMIT_REACHED'; end if;
  select * into v_parent from public.content_convergence_versions where id=p_parent_version_id;
  if v_parent.content_hash <> p_parent_hash then raise exception 'STALE_REPAIR_HASH'; end if;
  if v_parent.curriculum_identity is distinct from coalesce(p_curriculum_identity,'{}'::jsonb) then raise exception 'CURRICULUM_IDENTITY_MUTATION_BLOCKED'; end if;
  if coalesce(p_content_hash,'') = p_parent_hash then raise exception 'NO_MEANINGFUL_VERSION_CHANGE'; end if;
  insert into public.content_convergence_versions(publication_id,parent_version_id,version_number,content_hash,content_snapshot,worker_key,worker_execution_id,repair_reasons,findings_addressed,findings_preserved,provenance,curriculum_identity,evaluation_lineage)
  values(v_run.publication_id,p_parent_version_id,v_parent.version_number+1,p_content_hash,coalesce(p_content_snapshot,'{}'::jsonb),p_worker_key,p_worker_execution_id,coalesce(p_repair_reasons,'[]'::jsonb),coalesce(p_findings_addressed,'[]'::jsonb),coalesce(p_findings_preserved,'[]'::jsonb),coalesce(p_provenance,'{}'::jsonb),coalesce(p_curriculum_identity,'{}'::jsonb),'[]'::jsonb)
  returning id into v_new_id;
  update public.content_convergence_runs set current_version_id=v_new_id,attempt_count=attempt_count+1,state='REPAIRED',updated_at=now(),lease_owner=null,lease_expires_at=null where id=p_run_id;
  insert into public.content_convergence_events(run_id,from_state,to_state,actor,execution_id,artifact_version_id,artifact_hash,reason,evidence)
  values(p_run_id,'REPAIRING','REPAIRED',p_worker_key,p_worker_execution_id,v_new_id,p_content_hash,'immutable repair version created',jsonb_build_object('parent_version_id',p_parent_version_id,'parent_hash',p_parent_hash));
  return v_new_id;
end $$;

create or replace function public.content_convergence_record_evaluation(p_run_id uuid,p_version_id uuid,p_stage text,p_worker_execution_id text,p_content_hash text,p_disposition text,p_quality_score numeric,p_dimensions jsonb,p_findings jsonb,p_safety_status text,p_assessment_status text,p_provenance_status text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_run public.content_convergence_runs; v_hash text; v_id uuid;
begin
  select * into v_run from public.content_convergence_runs where id=p_run_id for update;
  if not found then raise exception 'CONVERGENCE_RUN_NOT_FOUND'; end if;
  if v_run.current_version_id <> p_version_id then raise exception 'STALE_EVALUATION_VERSION'; end if;
  select content_hash into v_hash from public.content_convergence_versions where id=p_version_id;
  if v_hash <> p_content_hash then raise exception 'STALE_EVALUATION_HASH'; end if;
  if p_stage not in ('P2','P3') then raise exception 'INVALID_EVALUATION_STAGE'; end if;
  insert into public.content_convergence_evaluations(run_id,version_id,stage,worker_execution_id,content_hash,disposition,quality_score,dimensions,findings,safety_status,assessment_status,provenance_status)
  values(p_run_id,p_version_id,p_stage,p_worker_execution_id,p_content_hash,p_disposition,p_quality_score,coalesce(p_dimensions,'{}'::jsonb),coalesce(p_findings,'[]'::jsonb),coalesce(p_safety_status,'UNKNOWN'),coalesce(p_assessment_status,'UNKNOWN'),coalesce(p_provenance_status,'UNKNOWN'))
  on conflict (run_id,version_id,stage,worker_execution_id) do update set disposition=excluded.disposition,quality_score=excluded.quality_score,dimensions=excluded.dimensions,findings=excluded.findings,safety_status=excluded.safety_status,assessment_status=excluded.assessment_status,provenance_status=excluded.provenance_status
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.content_convergence_release_gate(p_run_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_run public.content_convergence_runs; v_version public.content_convergence_versions; v_p2 public.content_convergence_evaluations; v_p3 public.content_convergence_evaluations; v_critical integer; v_severe_regression boolean; v_decision text; v_reason text;
begin
  select * into v_run from public.content_convergence_runs where id=p_run_id for update;
  if not found then raise exception 'CONVERGENCE_RUN_NOT_FOUND'; end if;
  select * into v_version from public.content_convergence_versions where id=v_run.current_version_id;
  select * into v_p2 from public.content_convergence_evaluations where run_id=p_run_id and version_id=v_version.id and stage='P2' order by created_at desc limit 1;
  select * into v_p3 from public.content_convergence_evaluations where run_id=p_run_id and version_id=v_version.id and stage='P3' order by created_at desc limit 1;
  select count(*) into v_critical from public.content_convergence_findings where run_id=p_run_id and severity='CRITICAL' and state not in ('VERIFIED_RESOLVED','SUPERSEDED');
  select coalesce(bool_or(severe_regression),false) into v_severe_regression from public.content_convergence_deltas where run_id=p_run_id and to_version_id=v_version.id;
  if v_run.state <> 'CONVERGED' then v_decision:='NOT_READY'; v_reason:='run has not converged';
  elsif v_p2.id is null or v_p3.id is null then v_decision:='NOT_READY'; v_reason:='fresh P2 and P3 evidence is required for exact version';
  elsif v_p2.content_hash <> v_version.content_hash or v_p3.content_hash <> v_version.content_hash then v_decision:='NOT_READY'; v_reason:='evaluation hash does not match release version';
  elsif v_p2.disposition <> 'PASS' or v_p3.disposition <> 'PASS' then v_decision:='NOT_READY'; v_reason:='latest independent evaluation is not PASS';
  elsif v_critical > 0 then v_decision:='NOT_READY'; v_reason:='unresolved critical finding';
  elsif v_severe_regression then v_decision:='NOT_READY'; v_reason:='zero-tolerance regression detected';
  elsif upper(v_p2.safety_status) <> 'PASS' or upper(v_p3.safety_status) <> 'PASS' then v_decision:='NOT_READY'; v_reason:='safety status is not PASS';
  elsif upper(v_p2.assessment_status) <> 'PASS' or upper(v_p3.assessment_status) <> 'PASS' then v_decision:='NOT_READY'; v_reason:='assessment integrity is not PASS';
  elsif upper(v_p2.provenance_status) <> 'PASS' or upper(v_p3.provenance_status) <> 'PASS' then v_decision:='HUMAN_REVIEW_REQUIRED'; v_reason:='provenance requires human authority';
  else v_decision:='RELEASE_CANDIDATE'; v_reason:='converged exact version has fresh independent evidence'; end if;
  insert into public.content_convergence_release_decisions(run_id,version_id,content_hash,decision,reason,evidence_packet)
  values(p_run_id,v_version.id,v_version.content_hash,v_decision,v_reason,jsonb_build_object('publication_id',v_run.publication_id,'version_id',v_version.id,'content_hash',v_version.content_hash,'p2_evaluation_id',v_p2.id,'p3_evaluation_id',v_p3.id,'attempt_count',v_run.attempt_count,'critical_open',v_critical,'severe_regression',v_severe_regression,'human_publication_approval_required',true))
  on conflict (run_id,version_id,content_hash) do update set decision=excluded.decision,reason=excluded.reason,evidence_packet=excluded.evidence_packet,created_at=now();
  return v_decision;
end $$;

create or replace function public.content_convergence_recover_expired_leases() returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  with expired as (update public.content_convergence_runs set state=case when state in ('REPAIRING','REVERIFYING','MEASURING') then 'ESCALATED' else state end,failure_code='LEASE_EXPIRED',decision_reason='execution lease expired; explicit recovery required',next_action='inspect evidence and resume from current immutable version',lease_owner=null,lease_expires_at=null,updated_at=now() where lease_expires_at < now() and state in ('REPAIRING','REVERIFYING','MEASURING') returning id) select count(*) into v_count from expired;
  return v_count;
end $$;

revoke all on function public.content_convergence_transition(uuid,text,text,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.content_convergence_create_repair_version(uuid,uuid,text,text,jsonb,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.content_convergence_record_evaluation(uuid,uuid,text,text,text,text,numeric,jsonb,jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.content_convergence_release_gate(uuid) from public, anon, authenticated;
revoke all on function public.content_convergence_recover_expired_leases() from public, anon, authenticated;
grant execute on function public.content_convergence_transition(uuid,text,text,uuid,text,text,text,text,jsonb) to service_role;
grant execute on function public.content_convergence_create_repair_version(uuid,uuid,text,text,jsonb,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.content_convergence_record_evaluation(uuid,uuid,text,text,text,text,numeric,jsonb,jsonb,text,text,text) to service_role;
grant execute on function public.content_convergence_release_gate(uuid) to service_role;
grant execute on function public.content_convergence_recover_expired_leases() to service_role;

create index if not exists idx_content_convergence_runs_publication_state on public.content_convergence_runs(publication_id,state,updated_at desc);
create index if not exists idx_content_convergence_findings_open on public.content_convergence_findings(run_id,state,severity);
create index if not exists idx_content_convergence_eval_latest on public.content_convergence_evaluations(run_id,version_id,stage,created_at desc);
create index if not exists idx_content_convergence_events_run on public.content_convergence_events(run_id,created_at,id);
