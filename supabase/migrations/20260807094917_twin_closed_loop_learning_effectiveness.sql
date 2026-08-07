create table if not exists public.student_twin_learning_exposures (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  outcome_id uuid null references public.curriculum_learning_outcomes(id) on delete set null,
  intervention_type text not null,
  intervention_key text not null,
  source_type text not null default 'twin_intervention',
  source_id uuid null,
  mastery_before numeric null,
  evidence_count_before integer not null default 0,
  exposed_at timestamptz not null default now(),
  resolved_at timestamptz null,
  mastery_after numeric null,
  evidence_count_after integer null,
  mastery_delta numeric null,
  successful boolean null,
  response_ms integer null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_twin_learning_exposures_intervention_nonempty check (length(btrim(intervention_type)) > 0),
  constraint student_twin_learning_exposures_key_nonempty check (length(btrim(intervention_key)) > 0)
);

create index if not exists idx_twin_learning_exposures_student_time
  on public.student_twin_learning_exposures(student_id, exposed_at desc);
create index if not exists idx_twin_learning_exposures_unresolved
  on public.student_twin_learning_exposures(student_id, outcome_id, exposed_at)
  where resolved_at is null;
create index if not exists idx_twin_learning_exposures_intervention
  on public.student_twin_learning_exposures(student_id, intervention_key, exposed_at desc);

alter table public.student_twin_learning_exposures enable row level security;

drop policy if exists student_twin_learning_exposures_select_own on public.student_twin_learning_exposures;
create policy student_twin_learning_exposures_select_own
on public.student_twin_learning_exposures
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_twin_learning_exposures.student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  )
);

revoke all on public.student_twin_learning_exposures from anon, public;
grant select on public.student_twin_learning_exposures to authenticated;

create or replace function public.twin_resolve_learning_exposures(p_student_id uuid, p_outcome_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_after numeric;
  v_count_after integer;
  v_delta numeric;
  v_resolved integer := 0;
begin
  if p_student_id is null then return 0; end if;

  for r in
    select *
    from public.student_twin_learning_exposures e
    where e.student_id = p_student_id
      and e.resolved_at is null
      and (p_outcome_id is null or e.outcome_id = p_outcome_id)
      and e.exposed_at <= now() - interval '1 minute'
    order by e.exposed_at
  loop
    if r.outcome_id is null then continue; end if;

    select som.mastery_score, som.evidence_count
      into v_after, v_count_after
    from public.student_outcome_mastery som
    where som.student_id = r.student_id
      and som.outcome_id = r.outcome_id;

    if v_count_after is null or v_count_after <= r.evidence_count_before then continue; end if;

    v_delta := case when v_after is null or r.mastery_before is null then null else v_after - r.mastery_before end;

    update public.student_twin_learning_exposures
       set resolved_at = now(), mastery_after = v_after, evidence_count_after = v_count_after,
           mastery_delta = v_delta, updated_at = now()
     where id = r.id;

    insert into public.student_twin_intervention_effects(
      student_id,outcome_id,intervention_type,intervention_key,
      attempts,successes,mean_mastery_delta,mean_response_ms,
      effectiveness_score,confidence,last_observed_at,metadata
    ) values (
      r.student_id,r.outcome_id,r.intervention_type,r.intervention_key,
      1,case when coalesce(r.successful,false) or coalesce(v_delta,0) > 0 then 1 else 0 end,
      v_delta,r.response_ms,
      case when v_delta is null then case when coalesce(r.successful,false) then 1 else 0 end
           else greatest(0, least(1, 0.5 + (v_delta / 100.0))) end,
      0.2,now(),
      coalesce(r.metadata,'{}'::jsonb) || jsonb_build_object('resolved_from_exposure',r.id,'mastery_before',r.mastery_before,'mastery_after',v_after,'mastery_delta',v_delta)
    )
    on conflict(student_id,intervention_key) do update set
      attempts = student_twin_intervention_effects.attempts + 1,
      successes = student_twin_intervention_effects.successes + case when coalesce(r.successful,false) or coalesce(v_delta,0) > 0 then 1 else 0 end,
      mean_mastery_delta = case
        when v_delta is null then student_twin_intervention_effects.mean_mastery_delta
        when student_twin_intervention_effects.mean_mastery_delta is null then v_delta
        else ((student_twin_intervention_effects.mean_mastery_delta * student_twin_intervention_effects.attempts) + v_delta) / (student_twin_intervention_effects.attempts + 1)
      end,
      mean_response_ms = case
        when r.response_ms is null then student_twin_intervention_effects.mean_response_ms
        when student_twin_intervention_effects.mean_response_ms is null then r.response_ms
        else ((student_twin_intervention_effects.mean_response_ms * student_twin_intervention_effects.attempts) + r.response_ms) / (student_twin_intervention_effects.attempts + 1)
      end,
      effectiveness_score = round((
        0.55 * ((student_twin_intervention_effects.successes + case when coalesce(r.successful,false) or coalesce(v_delta,0) > 0 then 1 else 0 end)::numeric / (student_twin_intervention_effects.attempts + 1))
        + 0.45 * greatest(0,least(1,0.5 + (coalesce(
          case when v_delta is null then student_twin_intervention_effects.mean_mastery_delta
               when student_twin_intervention_effects.mean_mastery_delta is null then v_delta
               else ((student_twin_intervention_effects.mean_mastery_delta * student_twin_intervention_effects.attempts) + v_delta) / (student_twin_intervention_effects.attempts + 1)
          end,0) / 100.0)))
      )::numeric,4),
      confidence = least(0.95, round(((student_twin_intervention_effects.attempts + 1) / 8.0)::numeric,4)),
      last_observed_at = now(),
      metadata = student_twin_intervention_effects.metadata || coalesce(r.metadata,'{}'::jsonb) || jsonb_build_object('latest_resolved_exposure',r.id,'latest_mastery_delta',v_delta),
      updated_at = now();

    v_resolved := v_resolved + 1;
  end loop;
  return v_resolved;
end;
$$;

revoke all on function public.twin_resolve_learning_exposures(uuid,uuid) from public, anon, authenticated;

create or replace function public.twin_record_verified_practice_effect(
  p_profile_id uuid,
  p_outcome_id uuid,
  p_intervention_type text,
  p_intervention_key text,
  p_success boolean,
  p_response_ms integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id uuid;
  v_before numeric;
  v_evidence_before integer := 0;
  v_exposure_id uuid;
begin
  if p_profile_id is null or length(trim(coalesce(p_intervention_type,''))) = 0 or length(trim(coalesce(p_intervention_key,''))) = 0 then return; end if;

  select id into v_student_id from public.students where profile_id = p_profile_id and deleted_at is null limit 1;
  if v_student_id is null then return; end if;

  if p_outcome_id is not null then
    select mastery_score, evidence_count into v_before, v_evidence_before
    from public.student_outcome_mastery
    where student_id = v_student_id and outcome_id = p_outcome_id;
  end if;

  perform public.twin_resolve_learning_exposures(v_student_id,p_outcome_id);

  insert into public.student_twin_learning_exposures(
    student_id,outcome_id,intervention_type,intervention_key,
    mastery_before,evidence_count_before,successful,response_ms,metadata
  ) values (
    v_student_id,p_outcome_id,p_intervention_type,p_intervention_key,
    v_before,coalesce(v_evidence_before,0),p_success,p_response_ms,
    coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_exposure_id;

  insert into public.student_twin_intervention_effects(
    student_id,outcome_id,intervention_type,intervention_key,
    attempts,successes,mean_mastery_delta,mean_response_ms,
    effectiveness_score,confidence,last_observed_at,metadata
  ) values (
    v_student_id,p_outcome_id,p_intervention_type,p_intervention_key,
    1,case when p_success then 1 else 0 end,null,p_response_ms,
    case when p_success then 0.65 else 0.35 end,0.1,now(),
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('latest_exposure_id',v_exposure_id,'awaiting_mastery_resolution',p_outcome_id is not null)
  )
  on conflict(student_id,intervention_key) do update set
    attempts = student_twin_intervention_effects.attempts + 1,
    successes = student_twin_intervention_effects.successes + case when p_success then 1 else 0 end,
    mean_response_ms = case
      when p_response_ms is null then student_twin_intervention_effects.mean_response_ms
      when student_twin_intervention_effects.mean_response_ms is null then p_response_ms
      else ((student_twin_intervention_effects.mean_response_ms * student_twin_intervention_effects.attempts) + p_response_ms) / (student_twin_intervention_effects.attempts + 1)
    end,
    effectiveness_score = round((0.55 * ((student_twin_intervention_effects.successes + case when p_success then 1 else 0 end)::numeric/(student_twin_intervention_effects.attempts+1)) + 0.45 * greatest(0,least(1,0.5 + coalesce(student_twin_intervention_effects.mean_mastery_delta,0)/100.0)))::numeric,4),
    confidence = least(0.95,round(((student_twin_intervention_effects.attempts+1)/8.0)::numeric,4)),
    last_observed_at = now(),
    metadata = student_twin_intervention_effects.metadata || coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('latest_exposure_id',v_exposure_id),
    updated_at = now();
end;
$$;

revoke all on function public.twin_record_verified_practice_effect(uuid,uuid,text,text,boolean,integer,jsonb) from public, anon, authenticated;

create or replace function public.student_get_twin_learning()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_resolved integer := 0;
  v_effects jsonb;
  v_recent jsonb;
  v_unresolved integer := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  v_resolved := public.twin_resolve_learning_exposures(v_student_id,null);

  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_effects
  from (
    select jsonb_build_object('intervention_type',intervention_type,'intervention_key',intervention_key,'outcome_id',outcome_id,'attempts',attempts,'successes',successes,'mean_mastery_delta',mean_mastery_delta,'mean_response_ms',mean_response_ms,'effectiveness_score',effectiveness_score,'confidence',confidence,'last_observed_at',last_observed_at) x
    from public.student_twin_intervention_effects
    where student_id=v_student_id
    order by confidence desc,effectiveness_score desc,last_observed_at desc nulls last
    limit 12
  ) q;

  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_recent
  from (
    select jsonb_build_object('id',id,'outcome_id',outcome_id,'intervention_type',intervention_type,'intervention_key',intervention_key,'mastery_before',mastery_before,'mastery_after',mastery_after,'mastery_delta',mastery_delta,'successful',successful,'exposed_at',exposed_at,'resolved_at',resolved_at) x
    from public.student_twin_learning_exposures
    where student_id=v_student_id
    order by exposed_at desc
    limit 12
  ) q;

  select count(*) into v_unresolved from public.student_twin_learning_exposures where student_id=v_student_id and resolved_at is null and outcome_id is not null;

  return jsonb_build_object('student_id',v_student_id,'resolved_now',v_resolved,'unresolved_exposures',v_unresolved,'learned_interventions',v_effects,'recent_exposures',v_recent,'policy','immediate_success_plus_delayed_verified_mastery_gain');
end;
$$;

revoke all on function public.student_get_twin_learning() from public, anon;
grant execute on function public.student_get_twin_learning() to authenticated;

create or replace function public.student_get_twin_brain()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state jsonb;
  v_mastery jsonb;
  v_prediction jsonb;
  v_priority jsonb;
  v_evidence jsonb;
  v_learning jsonb;
  v_adaptation jsonb;
  v_tutor jsonb;
  v_student_id uuid;
begin
  v_state := public.student_get_twin_state();
  v_mastery := public.student_get_twin_mastery();
  v_prediction := public.student_get_twin_prediction();
  v_priority := public.student_get_twin_priority();
  v_evidence := public.student_get_twin_evidence();
  v_learning := public.student_get_twin_learning();
  v_adaptation := public.student_get_twin_adaptation();
  v_student_id := nullif(v_state->>'student_id','')::uuid;

  v_tutor := jsonb_build_object(
    'mode','bounded','can_explain',true,'can_question',true,'can_hint',true,'can_generate_practice',true,
    'cannot_change_marks',true,'cannot_mark_verified_completion',true,'cannot_override_teacher_interventions',true,
    'cannot_claim_official_exam_prediction',true,'must_use_learner_evidence',true,'must_abstain_when_evidence_is_insufficient',true,
    'mastery',v_mastery,'prediction',v_prediction,'decision',v_priority,
    'learning',v_learning,'adaptation',v_adaptation,
    'interventions',coalesce(v_state->'interventions','[]'::jsonb),'curriculum',coalesce(v_state->'curriculum','{}'::jsonb)
  );

  v_state := v_state || jsonb_build_object('mastery',v_mastery,'prediction',v_prediction,'decision',v_priority,'evidence',v_evidence,'learning',v_learning,'adaptation',v_adaptation,'tutor',v_tutor);

  if v_student_id is not null then
    update public.student_twin_state_snapshots
       set state=v_state,
           confidence_score=coalesce((v_state->>'confidence')::numeric,confidence_score),
           evidence_count=coalesce((v_evidence->>'competency_evidence_count')::integer,evidence_count),
           generated_at=now(),updated_at=now()
     where student_id=v_student_id;
  end if;
  return v_state;
end;
$$;

revoke all on function public.student_get_twin_brain() from public, anon;
grant execute on function public.student_get_twin_brain() to authenticated;

create or replace function public.student_get_twin_tutor_context()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_brain jsonb;
begin
  v_brain := public.student_get_twin_brain();
  return jsonb_build_object('student_id',v_brain->'student_id','generated_at',v_brain->'generated_at','confidence',v_brain->'confidence','curriculum',v_brain->'curriculum','mastery',v_brain->'mastery','interventions',v_brain->'interventions','recommendations',v_brain->'recommendations','decision',v_brain->'decision','prediction',v_brain->'prediction','evidence',v_brain->'evidence','learning',v_brain->'learning','adaptation',v_brain->'adaptation','exam',v_brain->'exam','study_time',v_brain->'study_time','guardrails',v_brain->'tutor');
end;
$$;

revoke all on function public.student_get_twin_tutor_context() from public, anon;
grant execute on function public.student_get_twin_tutor_context() to authenticated;
