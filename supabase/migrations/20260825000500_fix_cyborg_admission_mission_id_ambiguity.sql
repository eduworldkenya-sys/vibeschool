begin;

-- A RETURNS TABLE output column is also a PL/pgSQL variable. Using
-- A column-list conflict target therefore made first-time mission admission fail
-- with "column reference mission_id is ambiguous". Name the PK constraint
-- explicitly so admission remains deterministic and retry-safe.
create or replace function public.hq_cyborg_admit_chat_mission(
  p_actor_key text, p_external_chat_id text, p_supplied_mission_id uuid,
  p_objective text, p_base_revision text
)
returns table(mission_id uuid, chat_session_id uuid, mission_revision text, mission_state text)
language plpgsql security invoker set search_path=public as $$
declare v_chat public.hq_cyborg_chat_sessions; v_mission public.hq_cyborg_missions;
begin
  if nullif(trim(p_actor_key),'') is null or nullif(trim(p_external_chat_id),'') is null then raise exception 'CYBORG_CHAT_IDENTITY_REQUIRED'; end if;
  if nullif(trim(p_objective),'') is null or nullif(trim(p_base_revision),'') is null then raise exception 'CYBORG_MISSION_CONTRACT_REQUIRED'; end if;
  insert into public.hq_cyborg_chat_sessions(actor_key, external_chat_id)
  values(left(trim(p_actor_key),240), left(trim(p_external_chat_id),240))
  on conflict(actor_key, external_chat_id) do update set updated_at=now() returning * into v_chat;
  if v_chat.status <> 'active' then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  if p_supplied_mission_id is not null then
    if v_chat.mission_id is null or v_chat.mission_id <> p_supplied_mission_id then raise exception 'CYBORG_CAPABILITY_MISSION_MISMATCH'; end if;
    select * into v_mission from public.hq_cyborg_missions where id=p_supplied_mission_id for update;
    if not found then raise exception 'CYBORG_MISSION_NOT_FOUND'; end if;
    if v_mission.state in ('complete','blocked','aborted') then raise exception 'CYBORG_MISSION_SUSPENDED'; end if;
  elsif v_chat.mission_id is not null then
    select * into v_mission from public.hq_cyborg_missions where id=v_chat.mission_id for update;
    if found and v_mission.state in ('complete','blocked','aborted') then v_mission := null; end if;
  end if;
  if v_mission.id is null then
    insert into public.hq_cyborg_missions(objective,state,base_revision,mission)
    values(left(trim(p_objective),4000),'received',trim(p_base_revision),jsonb_build_object('source','cyborg-admission','actorKey',left(trim(p_actor_key),240),'externalChatId',left(trim(p_external_chat_id),240),'admittedAt',now()))
    returning * into v_mission;
    insert into public.hq_cyborg_invocation_budgets(mission_id) values(v_mission.id)
      on conflict on constraint hq_cyborg_invocation_budgets_pkey do nothing;
    update public.hq_cyborg_chat_sessions as chat set mission_id=v_mission.id,updated_at=now()
      where chat.id=v_chat.id returning * into v_chat;
  end if;
  return query select v_mission.id,v_chat.id,v_mission.base_revision,v_mission.state;
end $$;

revoke all on function public.hq_cyborg_admit_chat_mission(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.hq_cyborg_admit_chat_mission(text,text,uuid,text,text) to service_role;

commit;
