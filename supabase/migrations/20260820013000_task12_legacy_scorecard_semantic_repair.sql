-- Task 12: preserve the existing Founder/HQ scorecard API while repairing auth semantics.
-- The authenticated client ingress cannot observe pre-auth credential attempts. The legacy
-- `login_attempts` field therefore becomes a compatibility alias for authenticated sessions
-- entering the post-auth application journey, and explicit semantics are returned alongside it.

begin;

create or replace function public.hq_get_pilot_observability_scorecard(p_since timestamptz default now()-interval '7 days')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception 'HQ_OWNER_REQUIRED' using errcode='42501';
  end if;

  with e as (
    select * from public.platform_events where occurred_at>=p_since
  ), rollup as (
    select
      count(*) filter(where event_type='auth.login_succeeded' and outcome='succeeded') post_auth_entries,
      count(*) filter(where event_type='auth.dashboard_reached' and outcome='succeeded') workspace_entries,
      count(*) filter(where event_type='auth.identity_failed' or (outcome='failed' and journey='authentication')) auth_identity_failures,
      count(distinct actor_id) filter(where event_type='teacher.useful_action_committed' and outcome='succeeded' and authoritative) activated_teachers,
      count(distinct actor_id) filter(where event_type='student.learning_activity_committed' and outcome='succeeded' and authoritative) activated_students,
      count(distinct actor_id) filter(where event_type='parent.child_insight_viewed' and outcome='succeeded' and authoritative) activated_parents,
      count(distinct actor_id) filter(where event_type='admin.school_operation_committed' and outcome='succeeded' and authoritative) activated_admins,
      count(*) filter(where journey='vibelearn' and outcome='failed') content_failures,
      count(*) filter(where outcome in ('failed','denied')) failures,
      max(occurred_at) freshest_event_at,
      percentile_cont(0.95) within group(order by latency_ms) filter(where latency_ms is not null) p95_latency_ms
    from e
  )
  select jsonb_build_object(
    'since',p_since,
    'generated_at',now(),
    'freshest_event_at',freshest_event_at,
    'freshness_state',case when freshest_event_at is null then 'UNKNOWN' when freshest_event_at<now()-interval '24 hours' then 'STALE' else 'FRESH' end,
    'entry',jsonb_build_object(
      'login_attempts',post_auth_entries,
      'login_attempts_semantics','compatibility alias: authenticated sessions beginning post-auth application entry; not credential attempts',
      'post_auth_entries',post_auth_entries,
      'workspace_entries',workspace_entries,
      'workspace_entry_rate',case when post_auth_entries=0 then null else round(100.0*workspace_entries/post_auth_entries,1) end
    ),
    'activation',jsonb_build_object(
      'teachers',activated_teachers,'students',activated_students,'parents',activated_parents,'admins',activated_admins
    ),
    'reliability',jsonb_build_object(
      'failures',failures,'content_failures',content_failures,'auth_identity_failures',auth_identity_failures,'p95_latency_ms',p95_latency_ms
    )
  ) into v
  from rollup;
  return v;
end;
$$;

revoke all on function public.hq_get_pilot_observability_scorecard(timestamptz) from public, anon, authenticated;
grant execute on function public.hq_get_pilot_observability_scorecard(timestamptz) to authenticated;

comment on function public.hq_get_pilot_observability_scorecard(timestamptz) is 'Owner-only compatibility scorecard. Auth denominator begins after Supabase authentication; zero observations yield null rate and missing/stale evidence is explicit.';

commit;
