-- WE-R1.4.15: monotonic resource version clock for hq_work_items.
-- NON-ACTIVATING. Every write, including human/admin/compensation writes, advances both
-- an integer revision and updated_at. Existing R1.4 precondition checks therefore cannot
-- accept an A->B->A stale snapshot merely because priority/status returned to its old value.

alter table public.hq_work_items
  add column if not exists worker_state_revision bigint not null default 0 check (worker_state_revision>=0);

create or replace function public.hq_workforce_advance_work_item_version()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  new.worker_state_revision:=old.worker_state_revision+1;
  new.updated_at:=clock_timestamp();
  return new;
end $$;

drop trigger if exists trg_hq_workforce_advance_work_item_version on public.hq_work_items;
create trigger trg_hq_workforce_advance_work_item_version
before update on public.hq_work_items
for each row execute function public.hq_workforce_advance_work_item_version();

revoke all on function public.hq_workforce_advance_work_item_version() from public,anon,authenticated,service_role;

-- Runtime remains off and no active authority may exist while the version invariant is installed.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.15 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.15 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.15 cannot install with active capability authority'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.hq_work_items'::regclass and tgname='trg_hq_workforce_advance_work_item_version' and not tgisinternal) then
    raise exception 'WE-R1.4.15 version trigger missing';
  end if;
end $$;
