-- VibeSchool Pathways — privacy-safe acquisition telemetry.
-- Funnel analytics records product transitions only. It deliberately has no
-- columns for learner answers, marks, pathway result, DOB, school or free text.

create table public.pathways_funnel_events (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id uuid not null,
  actor_id uuid,
  event_type text not null,
  route text,
  source text,
  campaign text,
  variant text,
  action text,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(idempotency_key)
);
alter table public.pathways_funnel_events enable row level security;
revoke all on table public.pathways_funnel_events from public, anon, authenticated;
grant select, insert, update, delete on table public.pathways_funnel_events to service_role;
-- service-only: public.pathways_funnel_events raw funnel rows are not client-readable or directly client-writable
-- authorization-test: anon/authenticated have no direct table privileges; bounded RPC below is the only product write surface

create index pathways_funnel_events_session_idx on public.pathways_funnel_events(anonymous_session_id, occurred_at desc);
create index pathways_funnel_events_type_idx on public.pathways_funnel_events(event_type, occurred_at desc);
create index pathways_funnel_events_actor_idx on public.pathways_funnel_events(actor_id, occurred_at desc) where actor_id is not null;

create or replace function public.pathways_record_funnel_event(
  p_anonymous_session_id uuid,
  p_event_type text,
  p_route text default null,
  p_source text default null,
  p_campaign text default null,
  p_variant text default null,
  p_action text default null,
  p_idempotency_key text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  caller uuid := auth.uid();
  eid uuid;
  events_today integer;
  normalized_event text := lower(trim(coalesce(p_event_type,'')));
  normalized_route text := nullif(left(trim(coalesce(p_route,'')),160),'');
  normalized_source text := nullif(left(trim(coalesce(p_source,'')),80),'');
  normalized_campaign text := nullif(left(trim(coalesce(p_campaign,'')),80),'');
  normalized_variant text := nullif(left(trim(coalesce(p_variant,'')),80),'');
  normalized_action text := nullif(left(trim(coalesce(p_action,'')),80),'');
  idem text := nullif(left(trim(coalesce(p_idempotency_key,'')),160),'');
begin
  if p_anonymous_session_id is null then raise exception 'anonymous_session_required'; end if;
  if normalized_event not in (
    'pathways_landing_viewed',
    'pathways_started',
    'pathways_meaningful_progress',
    'pathways_preliminary_result_viewed',
    'pathways_auth_prompt_viewed',
    'pathways_auth_started',
    'pathways_auth_completed',
    'pathways_state_restored',
    'pathways_full_result_viewed',
    'pathways_saved_or_adopted',
    'pathways_next_action_completed',
    'pathways_shared',
    'pathways_returned'
  ) then raise exception 'unsupported_pathways_event'; end if;

  if normalized_event in ('pathways_auth_completed','pathways_state_restored','pathways_saved_or_adopted') and caller is null then
    raise exception 'authenticated_event_requires_actor';
  end if;

  if normalized_route is not null and normalized_route not like '/pathways%' then
    raise exception 'invalid_pathways_route';
  end if;
  if idem is null or length(idem) < 8 then raise exception 'idempotency_key_required'; end if;

  select count(*) into events_today
  from public.pathways_funnel_events e
  where e.anonymous_session_id = p_anonymous_session_id
    and e.occurred_at >= now() - interval '24 hours';
  if events_today >= 200 then raise exception 'pathways_event_limit_reached'; end if;

  insert into public.pathways_funnel_events(
    anonymous_session_id, actor_id, event_type, route, source, campaign,
    variant, action, idempotency_key
  ) values (
    p_anonymous_session_id, caller, normalized_event, normalized_route,
    normalized_source, normalized_campaign, normalized_variant,
    normalized_action, idem
  )
  on conflict(idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning id into eid;

  return eid;
end;
$function$;

revoke all on function public.pathways_record_funnel_event(uuid,text,text,text,text,text,text,text) from public;
grant execute on function public.pathways_record_funnel_event(uuid,text,text,text,text,text,text,text) to anon, authenticated;

comment on function public.pathways_record_funnel_event(uuid,text,text,text,text,text,text,text) is
'Bounded Pathways funnel event façade. Accepts only whitelisted product transitions and short attribution strings. No learner answers, marks, result pathway, school, DOB or arbitrary metadata payload.';
