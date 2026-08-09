-- HQ product nervous system: canonical policy/runtime telemetry foundation.
-- Mirrors the migration already applied to the linked Supabase project.

-- Source of truth is the live migration version 20260809195852.
-- This file intentionally records the deployed migration in Git so schema history remains reproducible.

create table if not exists public.hq_product_policy_state (
  product_key text primary key,
  enabled boolean not null,
  policy_key text not null,
  policy_value jsonb not null default '{}'::jsonb,
  state text not null default 'verified',
  updated_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb
);

alter table public.hq_product_policy_state enable row level security;
revoke all on table public.hq_product_policy_state from public, anon;
grant select on table public.hq_product_policy_state to authenticated;
grant all on table public.hq_product_policy_state to service_role;

create or replace function public.hq_product_runtime_handshake(p_product_key text, p_route text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_key text:=trim(lower(p_product_key)); v_enabled boolean; v_policy text; v_event uuid; begin
  if v_key not in ('student','teacher','parent','school_admin','vibelearn','vibebooks','vibelabs','twin','billing') then raise exception 'Unknown product'; end if;
  v_policy:=v_key||'.enabled';
  v_enabled:=coalesce((public.hq_effective_policy_value(v_policy)#>>'{}')::boolean,true);
  insert into public.platform_events(event_type,actor_id,actor_role,metadata)
  values('product.runtime_seen',auth.uid(),coalesce(auth.jwt()->>'role','authenticated'),jsonb_build_object('product_key',v_key,'route',p_route,'enabled',v_enabled)) returning id into v_event;
  insert into public.hq_product_policy_state(product_key,enabled,policy_key,policy_value,state,updated_at,evidence)
  values(v_key,v_enabled,v_policy,to_jsonb(v_enabled),'verified',now(),jsonb_build_object('event_id',v_event,'route',p_route))
  on conflict(product_key) do update set enabled=excluded.enabled,policy_key=excluded.policy_key,policy_value=excluded.policy_value,state='verified',updated_at=now(),evidence=excluded.evidence;
  return jsonb_build_object('product_key',v_key,'enabled',v_enabled,'policy_key',v_policy,'verified_at',now(),'event_id',v_event);
end $$;

revoke all on function public.hq_product_runtime_handshake(text,text) from public,anon;
grant execute on function public.hq_product_runtime_handshake(text,text) to authenticated;

create or replace function public.hq_get_product_nervous_system(p_hours integer default 24)
returns jsonb language plpgsql security definer set search_path=public as $$
declare h int:=greatest(1,least(coalesce(p_hours,24),168)); begin
  perform public.hq_assert_owner();
  return jsonb_build_object(
    'captured_events',(select count(*) from public.platform_events where occurred_at>=now()-make_interval(hours=>h)),
    'runtime_surfaces',coalesce((select jsonb_agg(jsonb_build_object('product_key',metadata->>'product_key','events',count(*),'actors',count(distinct actor_id),'last_seen',max(occurred_at))) from public.platform_events where event_type='product.runtime_seen' and occurred_at>=now()-make_interval(hours=>h) group by metadata->>'product_key'),'[]'::jsonb),
    'policy_states',coalesce((select jsonb_agg(to_jsonb(s) order by product_key) from public.hq_product_policy_state s),'[]'::jsonb),
    'recent_policy_failures',coalesce((select jsonb_agg(to_jsonb(e) order by occurred_at desc) from (select id,event_type,occurred_at,metadata from public.platform_events where event_type='policy.failure' and occurred_at>=now()-make_interval(hours=>h) limit 50)e),'[]'::jsonb),
    'generated_at',now());
end $$;
revoke all on function public.hq_get_product_nervous_system(integer) from public,anon;
grant execute on function public.hq_get_product_nervous_system(integer) to authenticated;
