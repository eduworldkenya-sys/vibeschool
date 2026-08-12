-- Worker Engine WE-L2: governed execution foundation
-- Depends on WE-L1 authority/lifecycle primitives.
-- access: service-only public.hq_workforce_task_contracts
-- authorization-test: public.hq_workforce_task_contracts anon/authenticated denied; service_role only.
-- access: service-only public.hq_workforce_tool_contracts
-- authorization-test: public.hq_workforce_tool_contracts anon/authenticated denied; service_role only.
-- access: service-only public.hq_workforce_dead_letters
-- authorization-test: public.hq_workforce_dead_letters anon/authenticated denied; service_role only.

create table if not exists public.hq_workforce_tool_contracts (
  id uuid primary key default gen_random_uuid(),
  tool_key text not null,
  version integer not null check (version > 0),
  title text not null,
  handler_key text not null check (handler_key in ('work_item.triage_and_own')),
  required_capability_key text not null,
  operation text not null,
  resource_type text not null,
  side_effect_class text not null check (side_effect_class in ('internal_write')),
  status text not null default 'draft' check (status in ('draft','approved','superseded','revoked')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tool_key,version),
  check ((status <> 'approved') or approved_at is not null)
);

create table if not exists public.hq_workforce_task_contracts (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  schema_version integer not null default 1 check (schema_version=1),
  worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  tool_contract_id uuid not null references public.hq_workforce_tool_contracts(id) on delete restrict,
  capability_key text not null,
  operation text not null,
  resource_type text not null,
  scope_type text not null check (scope_type in ('platform_internal','global','school','multi_school')),
  scope_ref jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  budget_key text not null,
  budget_amount bigint not null default 1 check (budget_amount > 0),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','dead_letter','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_error text,
  execution_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists hq_workforce_task_queue_idx on public.hq_workforce_task_contracts(status,next_attempt_at,created_at);

create table if not exists public.hq_workforce_dead_letters (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.hq_workforce_task_contracts(id) on delete restrict,
  worker_key text not null,
  error_code text not null,
  error_detail text,
  attempts integer not null,
  payload_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.hq_workforce_release_budget(p_budget_id uuid,p_amount bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_amount<=0 then raise exception 'budget_release_must_be_positive'; end if;
  update public.hq_workforce_execution_budgets
  set reserved_amount=reserved_amount-p_amount,
      status=case when status='exhausted' and consumed_amount+reserved_amount-p_amount < limit_amount then 'active' else status end
  where id=p_budget_id and reserved_amount>=p_amount and status in ('active','exhausted');
  if not found then raise exception 'invalid_budget_release'; end if;
end $$;

create or replace function public.hq_workforce_tool_gateway_execute(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  cap public.hq_workforce_capability_grants%rowtype;
  budget_id uuid;
  work_item_id uuid;
  result jsonb;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;
  perform public.hq_workforce_assert_identity(t.worker_key);
  if public.hq_workforce_current_lifecycle_state(t.worker_key)<>'active' then raise exception 'worker_not_active'; end if;

  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;
  if tc.required_capability_key<>t.capability_key or tc.operation<>t.operation or tc.resource_type<>t.resource_type then
    raise exception 'task_tool_contract_mismatch';
  end if;

  select * into cap from public.hq_workforce_capability_grants
   where worker_key=t.worker_key and capability_key=t.capability_key and operation=t.operation and resource_type=t.resource_type
     and status='active' and expires_at>now()
   order by granted_at desc limit 1;
  if not found then raise exception 'worker_capability_denied'; end if;
  if cap.scope_type<>t.scope_type or cap.scope_ref<>t.scope_ref then raise exception 'task_scope_denied'; end if;

  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    if tc.handler_key='work_item.triage_and_own' then
      work_item_id := nullif(t.payload->>'work_item_id','')::uuid;
      if work_item_id is null then raise exception 'work_item_id_required'; end if;
      update public.hq_work_items
         set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('worker_key',t.worker_key,'action','triage_and_own','task_id',t.id),
             acted_at=coalesce(acted_at,now()),updated_at=now()
       where id=work_item_id;
      if not found then raise exception 'work_item_not_found'; end if;
      result:=jsonb_build_object('handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,'side_effect','hq_work_items.updated');
    else
      raise exception 'tool_handler_not_allowlisted';
    end if;
    perform public.hq_workforce_consume_budget(budget_id,t.budget_amount);
    return result;
  exception when others then
    perform public.hq_workforce_release_budget(budget_id,t.budget_amount);
    raise;
  end;
end $$;

create or replace function public.hq_workforce_execute_task_queue(p_limit integer default 20,p_lease_seconds integer default 60)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n integer:=0; evidence jsonb; err text;
begin
  if p_limit<1 or p_limit>100 then raise exception 'invalid_queue_limit'; end if;
  if p_lease_seconds<10 or p_lease_seconds>3600 then raise exception 'invalid_lease_seconds'; end if;

  update public.hq_workforce_task_contracts
     set status='queued',lease_expires_at=null,last_error=coalesce(last_error,'')||case when last_error is null then '' else '; ' end||'lease_expired'
   where status='running' and lease_expires_at<now();

  for r in
    select id from public.hq_workforce_task_contracts
     where status='queued' and next_attempt_at<=now()
     order by created_at
     for update skip locked limit p_limit
  loop
    update public.hq_workforce_task_contracts
       set status='running',attempt_count=attempt_count+1,started_at=coalesce(started_at,now()),lease_expires_at=now()+make_interval(secs=>p_lease_seconds)
     where id=r.id;
    begin
      evidence:=public.hq_workforce_tool_gateway_execute(r.id);
      update public.hq_workforce_task_contracts
         set status='completed',completed_at=now(),lease_expires_at=null,execution_evidence=evidence,last_error=null
       where id=r.id;
    exception when others then
      err:=sqlerrm;
      update public.hq_workforce_task_contracts
         set status=case when attempt_count>=max_attempts then 'dead_letter' else 'queued' end,
             next_attempt_at=case when attempt_count>=max_attempts then next_attempt_at else now()+make_interval(secs=>least(300,5*(2^greatest(attempt_count-1,0))::integer)) end,
             lease_expires_at=null,last_error=err
       where id=r.id;
      insert into public.hq_workforce_dead_letters(task_id,worker_key,error_code,error_detail,attempts,payload_snapshot)
      select id,worker_key,'EXECUTION_FAILED',err,attempt_count,payload from public.hq_workforce_task_contracts where id=r.id and status='dead_letter'
      on conflict(task_id) do update set error_detail=excluded.error_detail,attempts=excluded.attempts,payload_snapshot=excluded.payload_snapshot,created_at=now();
    end;
    n:=n+1;
  end loop;
  return n;
end $$;

alter table public.hq_workforce_tool_contracts enable row level security;
alter table public.hq_workforce_task_contracts enable row level security;
alter table public.hq_workforce_dead_letters enable row level security;

revoke all on table public.hq_workforce_tool_contracts,public.hq_workforce_task_contracts,public.hq_workforce_dead_letters from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.hq_workforce_tool_contracts,public.hq_workforce_task_contracts,public.hq_workforce_dead_letters to service_role;

revoke all on function public.hq_workforce_release_budget(uuid,bigint) from public,anon,authenticated;
revoke all on function public.hq_workforce_tool_gateway_execute(uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_execute_task_queue(integer,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_release_budget(uuid,bigint),public.hq_workforce_tool_gateway_execute(uuid),public.hq_workforce_execute_task_queue(integer,integer) to service_role;
