-- Task 9 Founder OS reconciliation on exact current main.
-- Reconstructs the production-evolved Founder OS without activating Worker runtime,
-- releasing Global Stop, granting authority, initiating payments, publishing, or executing work.

create or replace function public.hq_workforce_runtime_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_global_policies bigint;
  v_active_grants bigint;
  v_global_breakers bigint;
begin
  perform public.hq_assert_owner();
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;

  select count(*) into v_global_policies
  from public.hq_workforce_runtime_policies
  where status='active' and enabled and scope_kind='global' and scope_key='global';

  select count(*) into v_active_grants
  from public.hq_workforce_capability_authority_grants
  where status='active'
    and activated_at is not null
    and activated_at <= clock_timestamp()
    and expires_at > clock_timestamp()
    and revoked_at is null;

  select count(*) into v_global_breakers
  from public.hq_workforce_execution_breakers
  where scope_type='global' and scope_ref='global' and status='tripped';

  return jsonb_build_object(
    'runtime_execution_enabled',ec.runtime_execution_enabled,
    'runtime_autonomy_level',ec.runtime_autonomy_level,
    'runtime_max_risk',ec.runtime_max_risk,
    'shadow_stopped',not ec.shadow_enabled and not ec.shadow_scheduler_enabled and ec.shadow_global_stop,
    'global_stop_active',ec.shadow_global_stop,
    'active_global_policies',v_global_policies,
    'active_capability_grants',v_active_grants,
    'tripped_global_breakers',v_global_breakers,
    'can_request_activation',not ec.runtime_execution_enabled
      and not ec.shadow_enabled and not ec.shadow_scheduler_enabled and ec.shadow_global_stop
      and v_global_policies>0 and v_active_grants>0 and v_global_breakers=0,
    'blocked_reasons',jsonb_strip_nulls(jsonb_build_object(
      'runtime_already_enabled',case when ec.runtime_execution_enabled then true end,
      'shadow_not_stopped',case when ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then true end,
      'enabled_global_policy_missing',case when v_global_policies=0 then true end,
      'active_capability_authority_missing',case when v_active_grants=0 then true end,
      'global_breaker_tripped',case when v_global_breakers>0 then true end
    )),
    'observed_at',clock_timestamp()
  );
end $$;

revoke all on function public.hq_workforce_runtime_readiness() from public,anon,service_role;
grant execute on function public.hq_workforce_runtime_readiness() to authenticated;
comment on function public.hq_workforce_runtime_readiness() is
'Owner-only non-mutating Worker runtime readiness evidence for Founder OS.';

create or replace function public.hq_workforce_get_r13x_certification_snapshot(
  p_since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.hq_assert_owner();
  begin
    return public.hq_workforce_r13x_certification_assessment(p_since);
  exception when undefined_function then
    return jsonb_build_object(
      'certified',false,
      'available',false,
      'repository_or_trial_blockers',jsonb_build_array('r13x_metrics_contract_missing'),
      'recommendation_sample_present',false,
      'metrics',null,
      'observed_at',clock_timestamp(),
      'note','R1.3X certification metrics contract is missing. Certification is fail-closed; no evidence was inferred or fabricated.'
    );
  end;
end $$;

revoke all on function public.hq_workforce_get_r13x_certification_snapshot(timestamptz) from public,anon,service_role;
grant execute on function public.hq_workforce_get_r13x_certification_snapshot(timestamptz) to authenticated;

create or replace function public.hq_revenue_operations_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  mp public.mpesa_runtime_control%rowtype;
begin
  perform public.hq_assert_owner();
  select * into mp from public.mpesa_runtime_control where singleton=true;
  return jsonb_build_object(
    'observed_at',clock_timestamp(),
    'mpesa',jsonb_build_object(
      'initiation_enabled',coalesce(mp.initiation_enabled,false),
      'activated_at',mp.activated_at,
      'updated_at',mp.updated_at
    ),
    'orders',jsonb_build_object(
      'total',(select count(*) from public.learning_product_orders),
      'initiated',(select count(*) from public.learning_product_orders where status in ('initiated','pending')),
      'paid',(select count(*) from public.learning_product_orders where paid_at is not null),
      'fulfilled',(select count(*) from public.learning_product_orders where fulfilled_at is not null),
      'cancelled',(select count(*) from public.learning_product_orders where cancelled_at is not null),
      'refunded',(select count(*) from public.learning_product_orders where refunded_at is not null),
      'paid_not_fulfilled',(select count(*) from public.learning_product_orders where paid_at is not null and fulfilled_at is null and cancelled_at is null and refunded_at is null)
    ),
    'payment_attempts',jsonb_build_object(
      'total',(select count(*) from public.commerce_payment_attempts),
      'requested_7d',(select count(*) from public.commerce_payment_attempts where requested_at>=clock_timestamp()-interval '7 days'),
      'callback_received_7d',(select count(*) from public.commerce_payment_attempts where callback_received_at>=clock_timestamp()-interval '7 days'),
      'settled_7d',(select count(*) from public.commerce_payment_attempts where settled_at>=clock_timestamp()-interval '7 days'),
      'processing_errors_7d',(select count(*) from public.commerce_payment_attempts where processing_error is not null and updated_at>=clock_timestamp()-interval '7 days'),
      'callback_missing_over_15m',(select count(*) from public.commerce_payment_attempts where requested_at<clock_timestamp()-interval '15 minutes' and callback_received_at is null and settled_at is null)
    ),
    'callbacks',jsonb_build_object(
      'total',(select count(*) from public.commerce_payment_callback_events),
      'received_7d',(select count(*) from public.commerce_payment_callback_events where received_at>=clock_timestamp()-interval '7 days'),
      'processing_errors_7d',(select count(*) from public.commerce_payment_callback_events where processing_error is not null and received_at>=clock_timestamp()-interval '7 days'),
      'unprocessed',(select count(*) from public.commerce_payment_callback_events where processed_at is null)
    ),
    'entitlements',jsonb_build_object(
      'total',(select count(*) from public.learning_product_entitlements),
      'active',(select count(*) from public.learning_product_entitlements where status='active' and revoked_at is null and starts_at<=clock_timestamp() and (ends_at is null or ends_at>clock_timestamp())),
      'revoked',(select count(*) from public.learning_product_entitlements where revoked_at is not null or status='revoked')
    ),
    'subscriptions',jsonb_build_object(
      'active',(select count(*) from public.billing_subscriptions where status='active'),
      'trialing',(select count(*) from public.billing_subscriptions where status='trialing'),
      'past_due',(select count(*) from public.billing_subscriptions where status='past_due')
    ),
    'reconciliation',jsonb_build_object(
      'callback_without_attempt',(select count(*) from public.commerce_payment_callback_events c where not exists(select 1 from public.commerce_payment_attempts a where a.checkout_request_id=c.checkout_request_id)),
      'paid_without_entitlement',(select count(*) from public.learning_product_orders o where o.paid_at is not null and not exists(select 1 from public.learning_product_entitlements e where e.order_id=o.id and e.revoked_at is null))
    )
  );
end $$;

revoke all on function public.hq_revenue_operations_snapshot() from public,anon,service_role;
grant execute on function public.hq_revenue_operations_snapshot() to authenticated;

create or replace function public.hq_founder_os_snapshot_core(p_recent_limit integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  lim integer:=greatest(1,least(coalesce(p_recent_limit,25),100));
  v_open_incidents bigint;
  v_critical_incidents bigint;
  v_high_incidents bigint;
  v_open_findings bigint;
  v_critical_findings bigint;
  v_actionable_decisions bigint;
  v_overdue_high_work bigint;
  v_runs bigint;
  v_intents bigint;
  v_execution_verifications bigint;
  v_task_verifications bigint;
  v_failed_verifications bigint;
  v_heartbeats bigint;
  v_scheduler_events bigint;
  v_open_breakers bigint;
  v_state text;
  v_engine jsonb;
begin
  perform public.hq_assert_owner();

  select count(*),count(*) filter(where severity='critical'),count(*) filter(where severity='high')
  into v_open_incidents,v_critical_incidents,v_high_incidents
  from public.hq_incidents where resolved_at is null and status not in ('resolved','closed');

  select count(*),count(*) filter(where severity='critical')
  into v_open_findings,v_critical_findings
  from public.hq_findings where resolved_at is null and status not in ('resolved','closed');

  select count(*) into v_actionable_decisions from public.hq_workforce_decisions
  where status in ('pending','actionable','proposed','revision_requested','awaiting_review');

  select count(*) into v_overdue_high_work from public.hq_work_items
  where status in ('open','in_progress','waiting_approval') and priority in ('critical','high')
    and due_at is not null and due_at<clock_timestamp();

  select count(*) into v_runs from public.hq_workforce_runs;
  select count(*) into v_intents from public.hq_workforce_execution_intents;
  select count(*) into v_execution_verifications from public.hq_workforce_execution_verifications;
  select count(*) into v_task_verifications from public.hq_workforce_task_verifications;
  select count(*) into v_failed_verifications from public.hq_workforce_execution_verifications where passed is false;
  select count(*) into v_heartbeats from public.hq_workforce_heartbeat_runs;
  select count(*) into v_scheduler_events from public.hq_workforce_scheduler_events;
  select count(*) into v_open_breakers from public.hq_workforce_execution_breakers where status not in ('reset','closed','resolved');

  select jsonb_build_object(
    'runtime_execution_enabled',runtime_execution_enabled,
    'runtime_autonomy_level',runtime_autonomy_level,
    'runtime_max_risk',runtime_max_risk,
    'runtime_max_concurrency',runtime_max_concurrency,
    'runtime_max_executions_per_minute',runtime_max_executions_per_minute,
    'shadow_enabled',shadow_enabled,
    'shadow_scheduler_enabled',shadow_scheduler_enabled,
    'shadow_global_stop',shadow_global_stop,
    'factory_enabled',factory_enabled,
    'heartbeat_enabled',heartbeat_enabled,
    'updated_at',updated_at
  ) into v_engine from public.hq_workforce_engine_contract where singleton=true;

  v_state:=case
    when v_critical_incidents>0 then 'INCIDENT'
    when v_high_incidents>0 or v_critical_findings>0 or v_failed_verifications>0 or v_open_breakers>0 then 'DEGRADED'
    when v_open_findings>0 or v_actionable_decisions>0 or v_overdue_high_work>0
      or (v_runs>0 and (v_intents=0 or v_execution_verifications=0)) then 'ATTENTION'
    else 'LIVE'
  end;

  return jsonb_build_object(
    'generated_at',clock_timestamp(),
    'company_state',v_state,
    'state_precedence',jsonb_build_array('INCIDENT','DEGRADED','ATTENTION','LIVE'),
    'summary',jsonb_build_object(
      'open_incidents',v_open_incidents,
      'open_findings',v_open_findings,
      'actionable_decisions',v_actionable_decisions,
      'overdue_high_work',v_overdue_high_work,
      'open_breakers',v_open_breakers
    ),
    'execution_integrity',jsonb_build_object(
      'runs',v_runs,
      'intents',v_intents,
      'execution_verifications',v_execution_verifications,
      'task_verifications',v_task_verifications,
      'failed_verifications',v_failed_verifications,
      'heartbeat_runs',v_heartbeats,
      'scheduler_events',v_scheduler_events,
      'verification_gap',v_runs>0 and (v_intents=0 or v_execution_verifications=0),
      'historical_gap_note',case when v_runs>0 and (v_intents=0 or v_execution_verifications=0)
        then 'Historical runs exist without a complete intent-to-verification trail. This read model does not manufacture missing evidence.' else null end
    ),
    'engine',v_engine,
    'attention',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.rank_score desc,x.detected_at asc)
      from (
        select 'incident:'||i.id::text id,'incident' type,i.severity,i.title,
          coalesce(i.summary,'Production incident requires review.') explanation,
          coalesce(i.route,'/hq/intelligence') route,coalesce(i.owner_department,'Operations') owner,
          i.evidence,i.detected_at,(case i.severity when 'critical' then 1000 when 'high' then 800 else 500 end)::int rank_score
        from public.hq_incidents i where i.resolved_at is null and i.status not in ('resolved','closed')
        union all
        select 'finding:'||f.id::text,'finding',f.severity,f.title,coalesce(f.why_it_matters,f.explanation),
          '/hq/intelligence',coalesce(f.department_key,'Operations'),f.evidence,f.last_detected_at,
          (case f.severity when 'critical' then 900 when 'high' then 700 else 400 end + case when f.decision_required then 80 else 0 end)::int
        from public.hq_findings f where f.resolved_at is null and f.status not in ('resolved','closed')
        union all
        select 'decision:'||d.id::text,'decision',coalesce(d.risk,'normal'),d.proposed_action,d.reason,
          '/hq/decisions',coalesce(d.lane_key,'Founder'),
          jsonb_build_object('job_key',d.job_key,'run_id',d.run_id,'evidence_snapshot_id',d.evidence_snapshot_id),d.created_at,
          (case d.risk when 'critical' then 850 when 'high' then 650 else 350 end)::int
        from public.hq_workforce_decisions d where d.status in ('pending','actionable','proposed','revision_requested','awaiting_review')
        union all
        select 'work:'||w.id::text,'work',w.priority,w.title,coalesce(w.summary,'Overdue consequential work.'),
          coalesce(w.route,'/hq/intelligence'),coalesce(w.department_key,'Operations'),w.evidence,w.created_at,
          (case w.priority when 'critical' then 820 when 'high' then 620 else 300 end + case when w.due_at<clock_timestamp() then 100 else 0 end)::int
        from public.hq_work_items w
        where w.status in ('open','in_progress','waiting_approval') and w.priority in ('critical','high')
        order by rank_score desc,detected_at asc limit lim
      ) x
    ),'[]'::jsonb),
    'recent_execution',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select r.id,r.work_item_id,r.task_id,r.execution_intent_id,r.lane_key,r.worker_id,r.trigger_type,r.status,r.authority_result,
          r.started_at,r.completed_at,r.created_at,
          (r.execution_intent_id is not null or exists(
            select 1 from public.hq_workforce_execution_intents ei
            where ei.task_id=coalesce(r.task_id,r.work_item_id)
          )) as has_intent,
          exists(
            select 1 from public.hq_workforce_task_verifications tv
            where tv.task_id=coalesce(r.task_id,r.work_item_id)
          ) as has_task_verification
        from public.hq_workforce_runs r order by r.created_at desc limit lim
      ) x
    ),'[]'::jsonb),
    'notifications',jsonb_build_object(
      'open',(select count(*) from public.hq_notifications where resolved_at is null and status not in ('resolved','closed')),
      'deduplicated_repeat_events',(select count(*) from public.hq_notifications where occurrence_count>1 and resolved_at is null)
    )
  );
end $$;

revoke all on function public.hq_founder_os_snapshot_core(integer) from public,anon,service_role;
grant execute on function public.hq_founder_os_snapshot_core(integer) to authenticated;

create or replace function public.hq_founder_os_snapshot(p_recent_limit integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  base jsonb;
  revenue jsonb;
  r13x jsonb;
  v_state text;
  v_payment_exceptions bigint;
  v_content_critical bigint;
  v_content_high bigint;
  v_content_open bigint;
begin
  perform public.hq_assert_owner();
  base:=public.hq_founder_os_snapshot_core(p_recent_limit);
  revenue:=public.hq_revenue_operations_snapshot();
  r13x:=public.hq_workforce_get_r13x_certification_snapshot(clock_timestamp()-interval '7 days');

  v_payment_exceptions:=
    coalesce((revenue#>>'{payment_attempts,processing_errors_7d}')::bigint,0)+
    coalesce((revenue#>>'{payment_attempts,callback_missing_over_15m}')::bigint,0)+
    coalesce((revenue#>>'{callbacks,processing_errors_7d}')::bigint,0)+
    coalesce((revenue#>>'{callbacks,unprocessed}')::bigint,0)+
    coalesce((revenue#>>'{reconciliation,callback_without_attempt}')::bigint,0)+
    coalesce((revenue#>>'{reconciliation,paid_without_entitlement}')::bigint,0)+
    coalesce((revenue#>>'{orders,paid_not_fulfilled}')::bigint,0);

  select count(*),count(*) filter(where severity='critical'),count(*) filter(where severity='high')
  into v_content_open,v_content_critical,v_content_high
  from public.curriculum_content_health_signals
  where status not in ('resolved','closed');

  v_state:=coalesce(base->>'company_state','ATTENTION');
  if v_state<>'INCIDENT' and (v_payment_exceptions>0 or v_content_critical>0) then
    v_state:='DEGRADED';
  elsif v_state='LIVE' and (v_content_high>0 or v_content_open>0 or coalesce((r13x->>'available')::boolean,false)=false) then
    v_state:='ATTENTION';
  end if;

  return base||jsonb_build_object(
    'company_state',v_state,
    'business_integrity',jsonb_build_object(
      'payment_exceptions',v_payment_exceptions,
      'content_health_open',v_content_open,
      'content_health_critical',v_content_critical,
      'content_health_high',v_content_high,
      'mpesa_initiation_enabled',coalesce((revenue#>>'{mpesa,initiation_enabled}')::boolean,false),
      'r13x_certification_available',coalesce((r13x->>'available')::boolean,false),
      'r13x_certified',coalesce((r13x->>'certified')::boolean,false)
    )
  );
end $$;

revoke all on function public.hq_founder_os_snapshot(integer) from public,anon,service_role;
grant execute on function public.hq_founder_os_snapshot(integer) to authenticated;
comment on function public.hq_founder_os_snapshot(integer) is
'Owner-only production-evolved Founder OS read model. Observation evidence only; performs no consequential mutation.';
