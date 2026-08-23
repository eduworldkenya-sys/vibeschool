begin;

-- Fix hardened search_path resolution for the append-only Laban command ledger.
-- pgcrypto is installed in Supabase's extensions schema, so SECURITY DEFINER
-- functions must schema-qualify digest rather than relying on caller search_path.
-- NON-ACTIVATING: no runtime, scheduler, publishing, payment, or authority change.
-- authorization-test: preserves the existing command-mission existence/locking gate
-- and only repairs deterministic event hashing inside the existing ledger function.

create or replace function public.hq_workforce_command_append_event(
  p_mission_id uuid,
  p_actor_key text,
  p_event_type text,
  p_event jsonb
) returns bigint
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_prev text;
  v_hash text;
  v_id bigint;
begin
  if coalesce(p_actor_key,'')='' or coalesce(p_event_type,'')='' then
    raise exception 'command_event_identity_required';
  end if;

  perform 1
  from public.hq_workforce_command_missions
  where id=p_mission_id
  for update;
  if not found then raise exception 'command_mission_not_found'; end if;

  select event_hash into v_prev
  from public.hq_workforce_command_ledger
  where mission_id=p_mission_id
  order by id desc
  limit 1;

  v_hash:=pg_catalog.encode(
    extensions.digest(
      coalesce(v_prev,'')||p_mission_id::text||p_actor_key||p_event_type||p_event::text,
      'sha256'::text
    ),
    'hex'::text
  );

  insert into public.hq_workforce_command_ledger(
    mission_id,actor_key,event_type,event,previous_hash,event_hash
  ) values(
    p_mission_id,p_actor_key,p_event_type,p_event,v_prev,v_hash
  ) returning id into v_id;

  return v_id;
end $$;

revoke all on function public.hq_workforce_command_append_event(uuid,text,text,jsonb) from public,anon;

comment on function public.hq_workforce_command_append_event(uuid,text,text,jsonb) is
'Append-only workforce command ledger event writer with schema-qualified pgcrypto SHA-256 hashing for hardened search_path execution.';

commit;
