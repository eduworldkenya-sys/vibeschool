-- WE-R1.4 production lineage repair: restore the compensation foundation hidden by
-- the historical 20260815130100 migration-version collision.
--
-- Production recorded 20260815130100 as create_open_schools_kenya_kibera_batch1,
-- while repository history assigns that version to worker_engine_we_r1_4_compensation.
-- Applied history is immutable: this forward migration restores only the missing
-- Worker Engine foundation and does not rewrite or delete the historical ledger row.
--
-- NON-ACTIVATING: runtime, heartbeat, Factory, Shadow and autonomous execution remain OFF.
-- access: service-only public.hq_workforce_execution_compensations
-- authorization-test: public/anon/authenticated denied; service_role read-only.

do $guard$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'R1.4 compensation lineage repair requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0) <> 0
     or coalesce(ec.runtime_max_risk,0) <> 0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'R1.4 compensation lineage repair violated fail-closed runtime boundary';
  end if;
end
$guard$;

do $shape$
declare v_type text;
begin
  if to_regclass('public.hq_workforce_execution_intents') is null then
    raise exception 'R1.4 compensation lineage repair missing execution intents';
  end if;
  select data_type into v_type from information_schema.columns where table_schema='public' and table_name='hq_workforce_execution_intents' and column_name='authoritative_before_state';
  if v_type is not null and v_type <> 'jsonb' then raise exception 'R1.4 compensation lineage repair unexpected authoritative_before_state type: %',v_type; end if;
  select data_type into v_type from information_schema.columns where table_schema='public' and table_name='hq_workforce_execution_intents' and column_name='expected_after_state';
  if v_type is not null and v_type <> 'jsonb' then raise exception 'R1.4 compensation lineage repair unexpected expected_after_state type: %',v_type; end if;
end
$shape$;

alter table public.hq_workforce_execution_intents
  add column if not exists authoritative_before_state jsonb not null default '{}'::jsonb check (jsonb_typeof(authoritative_before_state)='object'),
  add column if not exists expected_after_state jsonb not null default '{}'::jsonb check (jsonb_typeof(expected_after_state)='object');

create table if not exists public.hq_workforce_execution_compensations (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.hq_workforce_execution_intents(id) on delete restrict,
  task_id uuid not null references public.hq_workforce_task_contracts(id) on delete restrict,
  authority_grant_id uuid not null references public.hq_workforce_capability_authority_grants(id) on delete restrict,
  plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
  capability_key text not null,
  capability_version integer not null check (capability_version>0),
  requested_by text not null check (char_length(btrim(requested_by)) between 3 and 240),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  before_state jsonb not null check (jsonb_typeof(before_state)='object' and before_state<>'{}'::jsonb),
  expected_current_state jsonb not null check (jsonb_typeof(expected_current_state)='object' and expected_current_state<>'{}'::jsonb),
  observed_current_state jsonb not null check (jsonb_typeof(observed_current_state)='object'),
  outcome text not null check (outcome in ('compensated','conflict_escalated','denied')),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default clock_timestamp()
);

do $comp_shape$
declare v_missing text;
begin
  select string_agg(c,',' order by c) into v_missing
  from unnest(array['id','intent_id','task_id','authority_grant_id','plan_step_id','capability_key','capability_version','requested_by','reason','before_state','expected_current_state','observed_current_state','outcome','evidence','created_at']) c
  where not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_execution_compensations' and column_name=c);
  if v_missing is not null then raise exception 'R1.4 compensation lineage repair unexpected compensation table shape; missing: %',v_missing; end if;
end
$comp_shape$;

create unique index if not exists hq_workforce_execution_compensations_one_success_idx on public.hq_workforce_execution_compensations(intent_id) where outcome='compensated';
create index if not exists hq_workforce_execution_compensations_outcome_idx on public.hq_workforce_execution_compensations(outcome,created_at desc);

alter table public.hq_workforce_execution_compensations enable row level security;
revoke all on table public.hq_workforce_execution_compensations from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_execution_compensations to service_role;

create or replace function public.hq_workforce_guard_execution_compensation_immutable()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin raise exception 'execution_compensation_immutable'; end $$;
revoke all on function public.hq_workforce_guard_execution_compensation_immutable() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_execution_compensation_immutable on public.hq_workforce_execution_compensations;
create trigger trg_hq_workforce_execution_compensation_immutable before update or delete on public.hq_workforce_execution_compensations for each row execute function public.hq_workforce_guard_execution_compensation_immutable();

-- 151302 is the canonical exact-state implementation. Never replace it with the older
-- collided 151301 gateway/compensation function bodies.
do $canonical$
begin
  if to_regprocedure('public.hq_workforce_capture_execution_authoritative_after_state()') is null then raise exception 'R1.4 compensation lineage repair missing canonical exact-state capture function'; end if;
  if to_regprocedure('public.hq_workforce_compensate_consequential_execution(uuid,text,text)') is null then raise exception 'R1.4 compensation lineage repair missing canonical compensation RPC'; end if;
  if not exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='hq_work_items' and t.tgname='trg_hq_workforce_capture_execution_authoritative_after_state' and not t.tgisinternal) then raise exception 'R1.4 compensation lineage repair missing canonical exact-state capture trigger'; end if;
end
$canonical$;

do $postflight$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  if to_regclass('public.hq_workforce_execution_compensations') is null then raise exception 'R1.4 compensation lineage repair table postcondition failed'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_execution_intents' and column_name='authoritative_before_state' and data_type='jsonb') or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_execution_intents' and column_name='expected_after_state' and data_type='jsonb') then raise exception 'R1.4 compensation lineage repair state-column postcondition failed'; end if;
  if not exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='hq_workforce_execution_compensations' and t.tgname='trg_hq_workforce_execution_compensation_immutable' and not t.tgisinternal) then raise exception 'R1.4 compensation lineage repair immutable-trigger postcondition failed'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'R1.4 compensation lineage repair changed runtime safety state'; end if;
end
$postflight$;
