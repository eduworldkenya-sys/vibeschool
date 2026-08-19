-- TASK 16: capture the budget/resource capacity that made an activation envelope admissible.

alter table public.hq_workforce_runtime_activation_envelopes
  add column if not exists budget_snapshot jsonb not null default '[]'::jsonb
  check (jsonb_typeof(budget_snapshot)='array');

create or replace function public.hq_workforce_guard_activation_envelope_authority_set()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_active integer; v_selected_active integer;
begin
  select count(*) into v_active
    from public.hq_workforce_capability_authority_grants
   where status='active' and activated_at is not null and activated_by is not null and expires_at>clock_timestamp();

  select count(*) into v_selected_active
    from public.hq_workforce_capability_authority_grants
   where id=any(new.authority_grant_ids)
     and status='active' and activated_at is not null and activated_by is not null and expires_at>clock_timestamp();

  if v_selected_active<>cardinality(new.authority_grant_ids) then
    raise exception 'runtime_activation_envelope_selected_authority_not_active';
  end if;
  if v_active<>v_selected_active then
    raise exception 'runtime_activation_unselected_active_authority_present';
  end if;

  select coalesce(jsonb_agg(x.item order by x.worker_key,x.budget_key),'[]'::jsonb)
    into new.budget_snapshot
    from (
      select distinct b.worker_key,b.budget_key,
        jsonb_build_object(
          'worker_key',b.worker_key,'budget_key',b.budget_key,'unit',b.unit,
          'limit_amount',b.limit_amount,'consumed_amount',b.consumed_amount,'reserved_amount',b.reserved_amount,
          'available_amount',greatest(0,b.limit_amount-b.consumed_amount-b.reserved_amount),
          'period_start',b.period_start,'period_end',b.period_end,'captured_at',clock_timestamp()
        ) item
      from public.hq_workforce_execution_budgets b
      join public.hq_workforce_capability_authority_grants g on g.permitted_worker_key=b.worker_key
      where g.id=any(new.authority_grant_ids)
        and b.status='active' and b.period_start<=clock_timestamp() and b.period_end>clock_timestamp()
        and (b.limit_amount-b.consumed_amount-b.reserved_amount)>0
    ) x;

  if jsonb_array_length(new.budget_snapshot)<1 then
    raise exception 'runtime_activation_budget_snapshot_required';
  end if;
  return new;
end $$;

create or replace function public.hq_workforce_guard_runtime_activation_envelope_budget_immutable()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if old.budget_snapshot is distinct from new.budget_snapshot then
    raise exception 'runtime_activation_envelope_budget_snapshot_immutable';
  end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_runtime_activation_envelope_budget_immutable
  on public.hq_workforce_runtime_activation_envelopes;
create trigger trg_hq_workforce_runtime_activation_envelope_budget_immutable
before update on public.hq_workforce_runtime_activation_envelopes
for each row execute function public.hq_workforce_guard_runtime_activation_envelope_budget_immutable();

revoke all on function public.hq_workforce_guard_runtime_activation_envelope_budget_immutable()
  from public,anon,authenticated,service_role;
