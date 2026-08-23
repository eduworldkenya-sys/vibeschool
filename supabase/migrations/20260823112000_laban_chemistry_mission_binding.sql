begin;

-- Canonical durable bridge between the bounded Chemistry mission and Laban command.
-- NON-ACTIVATING: this migration does not enable Worker runtime, shadow scheduler,
-- publishing, payments, consequential authority, or release Global Stop.
-- access: service-only public.chemistry_laban_command_bindings
-- authorization-test: direct public/anon/authenticated access is denied.
create table if not exists public.chemistry_laban_command_bindings (
  chemistry_mission_id uuid primary key references public.chemistry_worker_missions(id) on delete restrict,
  command_mission_id uuid not null unique references public.hq_workforce_command_missions(id) on delete restrict,
  commander_key text not null default 'laban' references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  check (commander_key = 'laban')
);

alter table public.chemistry_laban_command_bindings enable row level security;
revoke all on public.chemistry_laban_command_bindings from public,anon,authenticated,service_role;
grant select,insert on public.chemistry_laban_command_bindings to service_role;

create or replace function public.hq_bind_laban_chemistry_mission(p_chemistry_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  cm public.chemistry_worker_missions%rowtype;
  p public.vibe_publications%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  command_id uuid;
  existing_id uuid;
begin
  perform public.hq_assert_owner();

  select * into cm from public.chemistry_worker_missions where id=p_chemistry_mission_id for update;
  if not found then raise exception 'CHEMISTRY_MISSION_NOT_FOUND'; end if;
  if cm.state <> 'READY' then raise exception 'CHEMISTRY_MISSION_NOT_READY:%',cm.state; end if;
  if cm.mode <> 'shadow' then raise exception 'CHEMISTRY_MISSION_SHADOW_REQUIRED'; end if;

  select * into p from public.vibe_publications where id=cm.publication_id;
  if not found then raise exception 'CHEMISTRY_PUBLICATION_NOT_FOUND'; end if;
  if lower(coalesce(p.cbc_subject,'')) <> 'chemistry' and lower(coalesce(p.title,'')) not like '%chemistry%' then
    raise exception 'CHEMISTRY_PUBLICATION_REQUIRED';
  end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WORKFORCE_ENGINE_CONTRACT_REQUIRED'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'LABAN_CHEMISTRY_BINDING_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON';
  end if;

  if not exists(
    select 1 from public.hq_workforce_workers
    where worker_key='laban' and status in ('active','restricted')
  ) then raise exception 'LABAN_COMMANDER_NOT_AVAILABLE'; end if;

  select command_mission_id into existing_id
  from public.chemistry_laban_command_bindings
  where chemistry_mission_id=p_chemistry_mission_id;
  if existing_id is not null then
    return jsonb_build_object(
      'chemistry_mission_id',p_chemistry_mission_id,
      'command_mission_id',existing_id,
      'commander_key','laban',
      'state','BOUND'
    );
  end if;

  insert into public.hq_workforce_command_missions(
    commander_key,title,success_criteria,risk_budget,state
  ) values (
    'laban',
    'Bounded Grade 10 Chemistry mission: '||coalesce(p.title,p.id::text),
    jsonb_build_array(
      'Author uses only database-authorized evidence through Cyborg',
      'Quality independently evaluates the exact artifact version',
      'Critic independently evaluates the exact artifact version through a valid Chemistry stage lease',
      'Repair executes only against an independently verified finding through a valid Chemistry stage lease',
      'Any repaired candidate receives fresh Quality and fresh Critic review',
      'No publication or release occurs without human approval',
      'Laban cannot self-certify or mint authority'
    ),
    jsonb_build_object(
      'mode','shadow',
      'max_iterations',cm.iteration_budget,
      'publication_authority',false,
      'payment_authority',false,
      'runtime_activation_authority',false,
      'scheduler_authority',false,
      'global_stop_must_remain_on',true,
      'chemistry_mission_id',cm.id,
      'publication_id',cm.publication_id
    ),
    'planned'
  ) returning id into command_id;

  insert into public.chemistry_laban_command_bindings(
    chemistry_mission_id,command_mission_id,commander_key
  ) values (cm.id,command_id,'laban');

  perform public.hq_workforce_command_append_event(
    command_id,
    'laban',
    'chemistry.mission.bound',
    jsonb_build_object(
      'chemistry_mission_id',cm.id,
      'publication_id',cm.publication_id,
      'chemistry_state',cm.state,
      'mode',cm.mode,
      'runtime_posture',cm.runtime_posture
    )
  );

  return jsonb_build_object(
    'chemistry_mission_id',cm.id,
    'command_mission_id',command_id,
    'commander_key','laban',
    'state','BOUND'
  );
end $$;

-- Owner-gated canonical entry point: instantiate/refresh the bounded Chemistry
-- mission using its existing readiness proof, then bind Laban to it. It leaves
-- the Laban command mission PLANNED and the Chemistry mission READY; execution
-- remains impossible while Global Stop is on and runtime/shadow are off.
create or replace function public.hq_start_laban_chemistry_mission(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  chemistry jsonb;
  chemistry_id uuid;
  binding jsonb;
begin
  perform public.hq_assert_owner();
  chemistry:=public.hq_start_chemistry_worker_mission(p_publication_id);
  chemistry_id:=(chemistry->'mission'->>'id')::uuid;
  if chemistry_id is null then raise exception 'CHEMISTRY_MISSION_START_CONTRACT_INVALID'; end if;
  binding:=public.hq_bind_laban_chemistry_mission(chemistry_id);
  return jsonb_build_object('chemistry',chemistry,'laban_binding',binding);
end $$;

create or replace function public.hq_get_laban_chemistry_binding(p_chemistry_mission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare v jsonb;
begin
  perform public.hq_assert_owner();
  select jsonb_build_object(
    'chemistry_mission_id',b.chemistry_mission_id,
    'command_mission_id',b.command_mission_id,
    'commander_key',b.commander_key,
    'chemistry_state',cm.state,
    'chemistry_mode',cm.mode,
    'command_state',cmd.state,
    'command_title',cmd.title,
    'risk_budget',cmd.risk_budget,
    'created_at',b.created_at
  ) into v
  from public.chemistry_laban_command_bindings b
  join public.chemistry_worker_missions cm on cm.id=b.chemistry_mission_id
  join public.hq_workforce_command_missions cmd on cmd.id=b.command_mission_id
  where b.chemistry_mission_id=p_chemistry_mission_id;
  return v;
end $$;

revoke all on function public.hq_bind_laban_chemistry_mission(uuid),public.hq_start_laban_chemistry_mission(uuid),public.hq_get_laban_chemistry_binding(uuid) from public,anon;
grant execute on function public.hq_bind_laban_chemistry_mission(uuid),public.hq_start_laban_chemistry_mission(uuid),public.hq_get_laban_chemistry_binding(uuid) to authenticated,service_role;

commit;
