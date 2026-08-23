-- Cyborg model-call lineage. Non-activating: no worker/runtime/payment/publishing authority changes.
create table if not exists public.cyborg_model_invocations (
  id uuid primary key default gen_random_uuid(),
  capability_jti uuid not null unique,
  mission_id text not null,
  conversation_id text,
  provider text not null,
  model text not null,
  operation text not null default 'model.invoke' check (operation='model.invoke'),
  status text not null check (status in ('claimed','succeeded','failed')),
  response_digest text,
  failure_code text,
  claimed_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint cyborg_model_invocations_mission_nonempty check (btrim(mission_id)<>''),
  constraint cyborg_model_invocations_provider_nonempty check (btrim(provider)<>''),
  constraint cyborg_model_invocations_model_nonempty check (btrim(model)<>'')
);
alter table public.cyborg_model_invocations enable row level security;
revoke all on table public.cyborg_model_invocations from public, anon, authenticated;
grant select, insert, update on table public.cyborg_model_invocations to service_role;
create index if not exists cyborg_model_invocations_mission_idx on public.cyborg_model_invocations(mission_id, claimed_at desc);
create index if not exists cyborg_model_invocations_conversation_idx on public.cyborg_model_invocations(conversation_id, claimed_at desc) where conversation_id is not null;

create or replace function public.cyborg_claim_model_capability(
  p_capability_jti uuid, p_mission_id text, p_conversation_id text, p_provider text, p_model text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_mission_id),'')='' or coalesce(btrim(p_provider),'')='' or coalesce(btrim(p_model),'')='' then raise exception 'CYBORG_LINEAGE_FIELDS_REQUIRED'; end if;
  insert into public.cyborg_model_invocations(capability_jti,mission_id,conversation_id,provider,model,status)
  values(p_capability_jti,p_mission_id,nullif(btrim(p_conversation_id),''),p_provider,p_model,'claimed')
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'CYBORG_CAPABILITY_REPLAYED';
end $$;
revoke all on function public.cyborg_claim_model_capability(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.cyborg_claim_model_capability(uuid,text,text,text,text) to service_role;

create or replace function public.cyborg_complete_model_invocation(p_capability_jti uuid,p_succeeded boolean,p_response_digest text default null,p_failure_code text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.cyborg_model_invocations set status=case when p_succeeded then 'succeeded' else 'failed' end,response_digest=p_response_digest,failure_code=p_failure_code,completed_at=clock_timestamp() where capability_jti=p_capability_jti and status='claimed';
 if not found then raise exception 'CYBORG_INVOCATION_CLAIM_REQUIRED'; end if;
end $$;
revoke all on function public.cyborg_complete_model_invocation(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.cyborg_complete_model_invocation(uuid,boolean,text,text) to service_role;
