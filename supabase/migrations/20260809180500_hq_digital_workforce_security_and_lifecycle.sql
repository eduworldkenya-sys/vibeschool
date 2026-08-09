-- HQ Digital Workforce Engine hardening and deterministic lifecycle.
-- No LLM calls. No worker-to-worker natural-language execution.

-- Explicitly close Data API access. HQ workers operate through internal/service paths
-- and owner-authorized application code, not direct anon/authenticated table access.
revoke all on table public.hq_worker_templates from anon, authenticated;
revoke all on table public.hq_workers from anon, authenticated;
revoke all on table public.hq_worker_messages from anon, authenticated;
revoke all on table public.hq_worker_runs from anon, authenticated;
revoke all on table public.hq_worker_kpis from anon, authenticated;
revoke all on table public.hq_worker_certifications from anon, authenticated;

grant select, insert, update, delete on table public.hq_worker_templates to service_role;
grant select, insert, update, delete on table public.hq_workers to service_role;
grant select, insert, update, delete on table public.hq_worker_messages to service_role;
grant select, insert, update, delete on table public.hq_worker_runs to service_role;
grant select, insert, update, delete on table public.hq_worker_kpis to service_role;
grant select, insert, update, delete on table public.hq_worker_certifications to service_role;

create or replace function public.hq_claim_worker_message(p_worker_id uuid)
returns public.hq_worker_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_message public.hq_worker_messages;
begin
  select * into v_message
  from public.hq_worker_messages
  where to_worker_id = p_worker_id
    and status = 'pending'
  order by
    case priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
    created_at
  for update skip locked
  limit 1;

  if v_message.id is null then
    return null;
  end if;

  update public.hq_worker_messages
  set status = 'claimed', claimed_at = now()
  where id = v_message.id
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function public.hq_activate_worker(p_worker_id uuid, p_approved_by uuid)
returns public.hq_workers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_worker public.hq_workers;
  v_cert_count integer;
  v_failed_count integer;
begin
  if not public.is_platform_owner(p_approved_by) then
    raise exception 'HQ owner authorization required';
  end if;

  select * into v_worker from public.hq_workers where id = p_worker_id for update;
  if v_worker.id is null then raise exception 'Worker not found'; end if;
  if v_worker.status <> 'probation' then raise exception 'Worker must be in probation before activation'; end if;

  select count(*), count(*) filter (where passed = false)
    into v_cert_count, v_failed_count
  from public.hq_worker_certifications
  where worker_id = p_worker_id;

  if v_cert_count = 0 or v_failed_count > 0 then
    raise exception 'Worker certification incomplete or failed';
  end if;

  update public.hq_workers
  set status = 'active', updated_at = now()
  where id = p_worker_id
  returning * into v_worker;

  return v_worker;
end;
$$;

revoke execute on function public.hq_claim_worker_message(uuid) from public, anon, authenticated;
revoke execute on function public.hq_activate_worker(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hq_claim_worker_message(uuid) to service_role;
grant execute on function public.hq_activate_worker(uuid, uuid) to service_role;

comment on function public.hq_claim_worker_message(uuid) is 'Internal deterministic work-bus claim using SKIP LOCKED. service_role only.';
comment on function public.hq_activate_worker(uuid, uuid) is 'Activates only certified probation workers after explicit platform-owner approval. service_role only.';
