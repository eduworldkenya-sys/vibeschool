-- Correct the policy-failure timestamp column used by the HQ nervous-system report.
create or replace function public.hq_get_product_nervous_system(p_hours integer default 24)
returns jsonb language plpgsql security definer set search_path=public as $$
declare h int:=greatest(1,least(coalesce(p_hours,24),168));
begin
 perform public.hq_assert_owner();
 return jsonb_build_object(
  'window_hours',h,
  'runtime_surfaces',coalesce((select jsonb_agg(x order by x->>'product_key') from (select jsonb_build_object('product_key',metadata->>'product_key','events',count(*),'actors',count(distinct actor_id),'last_seen',max(occurred_at)) x from public.platform_events where event_type='product.runtime_seen' and occurred_at>=now()-make_interval(hours=>h) group by metadata->>'product_key') q),'[]'::jsonb),
  'event_families',coalesce((select jsonb_agg(x order by (x->>'events')::int desc) from (select jsonb_build_object('family',split_part(event_type,'.',1),'events',count(*),'last_seen',max(occurred_at)) x from public.platform_events where occurred_at>=now()-make_interval(hours=>h) group by split_part(event_type,'.',1)) q),'[]'::jsonb),
  'policy_states',coalesce((select jsonb_agg(jsonb_build_object('product_key',product_key,'policy_key',policy_key,'state',state,'desired',desired_value,'observed',observed_value,'verified_at',verified_at,'last_error',last_error) order by product_key,policy_key) from public.hq_product_policy_state),'[]'::jsonb),
  'recent_policy_failures',coalesce((select jsonb_agg(jsonb_build_object('product_key',product_key,'policy_key',policy_key,'error_code',error_code,'error_message',error_message,'created_at',created_at) order by created_at desc) from (select * from public.hq_policy_failures where created_at>=now()-make_interval(hours=>h) order by created_at desc limit 20) f),'[]'::jsonb),
  'captured_events',(select count(*) from public.platform_events where occurred_at>=now()-make_interval(hours=>h)),
  'generated_at',now());
end $$;
revoke all on function public.hq_get_product_nervous_system(integer) from public,anon;
grant execute on function public.hq_get_product_nervous_system(integer) to authenticated;
