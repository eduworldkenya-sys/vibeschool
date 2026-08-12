-- WE-L1 hardening: immutable contracts, authority ceilings, precise grants.

create or replace function public.hq_workforce_guard_contract_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'worker_contract_delete_forbidden'; end if;
  if (new.contract_type,new.contract_key,new.version,new.payload,new.scope_type,new.scope_ref,new.issued_at,new.expires_at,new.created_at)
     is distinct from
     (old.contract_type,old.contract_key,old.version,old.payload,old.scope_type,old.scope_ref,old.issued_at,old.expires_at,old.created_at) then
    raise exception 'issued_worker_contract_immutable';
  end if;
  if old.status <> new.status and not (old.status='issued' and new.status in ('superseded','revoked','expired')) then
    raise exception 'illegal_worker_contract_status_transition';
  end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_guard_contract_mutation on public.hq_workforce_contracts;
create trigger trg_hq_workforce_guard_contract_mutation before update or delete on public.hq_workforce_contracts for each row execute function public.hq_workforce_guard_contract_mutation();

create or replace function public.hq_workforce_guard_blueprint_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' and old.status<>'draft' then raise exception 'approved_worker_blueprint_delete_forbidden'; end if;
  if tg_op='UPDATE' and old.status<>'draft' then
    if (new.blueprint_key,new.version,new.title,new.mission,new.authority_ceiling,new.required_capabilities,new.required_skill_keys,new.approval_boundaries,new.scope_type,new.scope_ref,new.approved_at,new.created_at)
       is distinct from
       (old.blueprint_key,old.version,old.title,old.mission,old.authority_ceiling,old.required_capabilities,old.required_skill_keys,old.approval_boundaries,old.scope_type,old.scope_ref,old.approved_at,old.created_at) then
      raise exception 'approved_worker_blueprint_immutable';
    end if;
    if old.status <> new.status and not (old.status='approved' and new.status in ('superseded','revoked')) then
      raise exception 'illegal_worker_blueprint_status_transition';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists trg_hq_workforce_guard_blueprint_mutation on public.hq_workforce_blueprints;
create trigger trg_hq_workforce_guard_blueprint_mutation before update or delete on public.hq_workforce_blueprints for each row execute function public.hq_workforce_guard_blueprint_mutation();

create or replace function public.hq_workforce_validate_creation_contract()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_bp public.hq_workforce_blueprints%rowtype;
begin
  select * into v_bp from public.hq_workforce_blueprints where id=new.blueprint_id;
  if not found or v_bp.status<>'approved' then raise exception 'approved_blueprint_required'; end if;
  if jsonb_typeof(v_bp.authority_ceiling)<>'array' or jsonb_typeof(new.authority_ceiling)<>'array' then raise exception 'authority_ceiling_must_be_array'; end if;
  if not (new.authority_ceiling <@ v_bp.authority_ceiling) then raise exception 'creation_authority_exceeds_blueprint'; end if;
  if new.scope_type<>v_bp.scope_type then raise exception 'creation_scope_type_exceeds_blueprint'; end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_validate_creation_contract on public.hq_workforce_creation_contracts;
create trigger trg_hq_workforce_validate_creation_contract before insert or update on public.hq_workforce_creation_contracts for each row execute function public.hq_workforce_validate_creation_contract();

create or replace function public.hq_workforce_guard_creation_contract_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'worker_creation_contract_delete_forbidden'; end if;
  if (new.contract_key,new.worker_key,new.blueprint_id,new.demand_evidence_contract_id,new.authority_ceiling,new.scope_type,new.scope_ref,new.issued_at,new.expires_at)
     is distinct from
     (old.contract_key,old.worker_key,old.blueprint_id,old.demand_evidence_contract_id,old.authority_ceiling,old.scope_type,old.scope_ref,old.issued_at,old.expires_at) then
    raise exception 'worker_creation_contract_immutable';
  end if;
  if old.status<>new.status and not (old.status='issued' and new.status in ('consumed','revoked','expired')) then raise exception 'illegal_creation_contract_status_transition'; end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_guard_creation_contract_mutation on public.hq_workforce_creation_contracts;
create trigger trg_hq_workforce_guard_creation_contract_mutation before update or delete on public.hq_workforce_creation_contracts for each row execute function public.hq_workforce_guard_creation_contract_mutation();

create or replace function public.hq_workforce_validate_capability_grant()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_contract public.hq_workforce_creation_contracts%rowtype;
begin
  select * into v_contract from public.hq_workforce_creation_contracts where id=new.granted_by_contract_id;
  if not found or v_contract.worker_key<>new.worker_key or v_contract.status not in ('issued','consumed') or (v_contract.expires_at is not null and v_contract.expires_at<=now()) then
    raise exception 'valid_worker_creation_contract_required_for_capability';
  end if;
  if not (v_contract.authority_ceiling ? new.capability_key) then raise exception 'capability_exceeds_creation_authority_ceiling'; end if;
  if new.scope_type<>v_contract.scope_type then raise exception 'capability_scope_type_exceeds_creation_contract'; end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_validate_capability_grant on public.hq_workforce_capability_grants;
create trigger trg_hq_workforce_validate_capability_grant before insert or update on public.hq_workforce_capability_grants for each row execute function public.hq_workforce_validate_capability_grant();

create or replace function public.hq_workforce_guard_lifecycle_event_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'worker_lifecycle_event_immutable';
end $$;

drop trigger if exists trg_hq_workforce_guard_lifecycle_event_mutation on public.hq_workforce_lifecycle_events;
create trigger trg_hq_workforce_guard_lifecycle_event_mutation before update or delete on public.hq_workforce_lifecycle_events for each row execute function public.hq_workforce_guard_lifecycle_event_mutation();

revoke all on table public.hq_workforce_contracts,public.hq_workforce_blueprints,public.hq_workforce_creation_contracts,public.hq_workforce_lifecycle_events,public.hq_workforce_identities,public.hq_workforce_capability_grants,public.hq_workforce_execution_budgets from service_role;
grant select,insert,update,delete on table public.hq_workforce_contracts,public.hq_workforce_blueprints,public.hq_workforce_creation_contracts,public.hq_workforce_lifecycle_events,public.hq_workforce_identities,public.hq_workforce_capability_grants,public.hq_workforce_execution_budgets to service_role;
revoke truncate,references,trigger on table public.hq_workforce_contracts,public.hq_workforce_blueprints,public.hq_workforce_creation_contracts,public.hq_workforce_lifecycle_events,public.hq_workforce_identities,public.hq_workforce_capability_grants,public.hq_workforce_execution_budgets from service_role;

revoke all on function public.hq_workforce_guard_contract_mutation(),public.hq_workforce_guard_blueprint_mutation(),public.hq_workforce_validate_creation_contract(),public.hq_workforce_guard_creation_contract_mutation(),public.hq_workforce_validate_capability_grant(),public.hq_workforce_guard_lifecycle_event_mutation() from public,anon,authenticated;
grant execute on function public.hq_workforce_guard_contract_mutation(),public.hq_workforce_guard_blueprint_mutation(),public.hq_workforce_validate_creation_contract(),public.hq_workforce_guard_creation_contract_mutation(),public.hq_workforce_validate_capability_grant(),public.hq_workforce_guard_lifecycle_event_mutation() to service_role;
