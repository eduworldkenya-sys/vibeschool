-- Pathways Quick Check contract hardening.
-- A learner-supplied idempotency key is bound to one semantic decision, and
-- uncertain/tied/weak scores cannot be persisted as a pathway selection.

create or replace function public.pathways_save_my_quick_check(
  p_pathway_slug text,
  p_answers jsonb,
  p_scores jsonb,
  p_rule_version text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  chosen public.pathways%rowtype;
  existing public.pathway_profile_decisions%rowtype;
  decision_id uuid;
  evidence jsonb;
  stem_score integer;
  social_score integer;
  arts_score integer;
  selected_score integer;
  runner_score integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select role into caller_role from public.profiles where id=caller;
  if caller_role not in ('student','global_user') then raise exception 'learner_role_required'; end if;

  if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>128 then
    raise exception 'invalid_idempotency_key';
  end if;
  if p_rule_version is null or length(trim(p_rule_version))<3 or length(p_rule_version)>80 then
    raise exception 'invalid_rule_version';
  end if;
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' or jsonb_typeof(coalesce(p_scores,'{}'::jsonb))<>'object' then
    raise exception 'invalid_payload_shape';
  end if;
  if jsonb_typeof(p_scores->'stem')<>'number' or jsonb_typeof(p_scores->'social')<>'number' or jsonb_typeof(p_scores->'arts')<>'number' then
    raise exception 'invalid_score_shape';
  end if;

  stem_score := (p_scores->>'stem')::integer;
  social_score := (p_scores->>'social')::integer;
  arts_score := (p_scores->>'arts')::integer;
  if stem_score<0 or social_score<0 or arts_score<0 then raise exception 'invalid_scores'; end if;

  select * into chosen
  from public.pathways
  where slug=lower(trim(p_pathway_slug)) and status='published' and verification_state='verified';
  if not found then raise exception 'verified_pathway_not_found'; end if;

  if chosen.slug='stem' then
    selected_score := stem_score; runner_score := greatest(social_score,arts_score);
  elsif chosen.slug='social-sciences' then
    selected_score := social_score; runner_score := greatest(stem_score,arts_score);
  elsif chosen.slug='arts-and-sports-science' then
    selected_score := arts_score; runner_score := greatest(stem_score,social_score);
  else
    raise exception 'unsupported_quick_check_pathway';
  end if;

  if selected_score<4 or selected_score-runner_score<2 then
    raise exception 'quick_check_uncertain';
  end if;

  evidence := jsonb_build_object(
    'evidence_class','learner_supplied_quick_check',
    'answers',coalesce(p_answers,'{}'::jsonb),
    'scores',p_scores,
    'disclaimer','VibeSchool guidance; not an official placement decision.'
  );

  select * into existing
  from public.pathway_profile_decisions
  where profile_id=caller and idempotency_key=p_idempotency_key
  for update;

  if found then
    if existing.pathway_id<>chosen.id
       or existing.decision_type<>'quick_check_saved'
       or existing.rule_version<>p_rule_version
       or existing.evidence_snapshot<>evidence then
      raise exception 'idempotency_key_reused_for_different_decision';
    end if;
    decision_id := existing.id;
  else
    insert into public.pathway_profile_decisions(
      profile_id,pathway_id,decision_type,evidence_snapshot,rule_version,idempotency_key
    ) values (
      caller,chosen.id,'quick_check_saved',evidence,p_rule_version,p_idempotency_key
    ) returning id into decision_id;
  end if;

  insert into public.pathway_profile_passports(
    profile_id,pathway_id,source_decision_id,rule_version,evidence_snapshot,adopted_at,updated_at
  ) values (
    caller,chosen.id,decision_id,p_rule_version,jsonb_build_object('scores',p_scores),now(),now()
  )
  on conflict(profile_id) do update set
    pathway_id=excluded.pathway_id,
    source_decision_id=excluded.source_decision_id,
    rule_version=excluded.rule_version,
    evidence_snapshot=excluded.evidence_snapshot,
    adopted_at=excluded.adopted_at,
    updated_at=now();

  return jsonb_build_object(
    'ok',true,
    'pathway_slug',chosen.slug,
    'pathway_name',chosen.name,
    'decision_id',decision_id,
    'idempotent_replay',existing.id is not null
  );
end
$$;

revoke all on function public.pathways_save_my_quick_check(text,jsonb,jsonb,text,text) from public,anon;
grant execute on function public.pathways_save_my_quick_check(text,jsonb,jsonb,text,text) to authenticated;

-- authorization-test: only authenticated learner roles execute; auth identity/role remains external authority.
-- idempotency-test: same key + same semantic decision replays; same key + changed payload/pathway fails closed.
-- uncertainty-test: zero, tied, weak, or margin<2 scores cannot persist a pathway decision.
