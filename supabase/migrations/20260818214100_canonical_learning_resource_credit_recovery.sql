-- R3.6.1 crash-safe canonical credit recovery.
-- Any claimed -> failed transition automatically returns an uncommitted credit.
-- A bounded recovery RPC sweeps expired claims so process crashes cannot strand
-- teacher credits indefinitely.

begin;

create or replace function public.cla_refund_credit_on_failed_claim()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_wallet public.vibe_credits%rowtype;
  v_new_balance integer;
begin
  if old.status <> 'claimed'
     or new.status <> 'failed'
     or old.credit_reserved = 0
     or old.credit_refunded_at is not null then
    return new;
  end if;

  select * into v_wallet
  from public.vibe_credits
  where teacher_id = old.requested_by
  for update;

  if v_wallet.teacher_id is null then
    raise exception using errcode='P0001', message='CLA_CREDIT_WALLET_UNAVAILABLE';
  end if;

  v_new_balance := v_wallet.balance + old.credit_reserved;

  update public.vibe_credits
  set balance = v_new_balance,
      total_spent = greatest(0, total_spent - old.credit_reserved),
      updated_at = now()
  where teacher_id = old.requested_by;

  insert into public.vibe_credit_transactions(
    teacher_id, type, feature, amount, balance_after, notes
  ) values (
    old.requested_by,
    'refund',
    'canonical_lesson_plan_gap',
    old.credit_reserved,
    v_new_balance,
    left(
      'Canonical generation auto-refund: ' ||
      coalesce(new.failure_reason, 'claim_failed'),
      500
    )
  );

  new.credit_refunded_at := now();
  return new;
end;
$$;

revoke all on function public.cla_refund_credit_on_failed_claim()
  from public, anon, authenticated;

drop trigger if exists cla_refund_credit_on_failed_claim
  on public.learning_resource_generation_claims;
create trigger cla_refund_credit_on_failed_claim
before update of status
on public.learning_resource_generation_claims
for each row
when (old.status = 'claimed' and new.status = 'failed')
execute function public.cla_refund_credit_on_failed_claim();

create or replace function public.cla_recover_expired_learning_resource_claims(
  p_limit integer default 100
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_recovered integer := 0;
begin
  if p_limit < 1 or p_limit > 1000 then
    raise exception using errcode='22023', message='CLA_RECOVERY_LIMIT_INVALID';
  end if;

  with expired as (
    select c.id
    from public.learning_resource_generation_claims c
    where c.status = 'claimed'
      and c.expires_at <= now()
    order by c.expires_at
    limit p_limit
    for update skip locked
  )
  update public.learning_resource_generation_claims c
  set status = 'failed',
      failed_at = coalesce(c.failed_at, now()),
      failure_reason = coalesce(c.failure_reason, 'claim_expired_recovered'),
      updated_at = now()
  from expired e
  where c.id = e.id;

  get diagnostics v_recovered = row_count;
  return v_recovered;
end;
$$;

revoke all on function public.cla_recover_expired_learning_resource_claims(integer)
  from public, anon, authenticated;
grant execute on function public.cla_recover_expired_learning_resource_claims(integer)
  to service_role;

comment on function public.cla_refund_credit_on_failed_claim() is
  'Crash-safe accounting guard: any uncommitted credit reservation is returned exactly once when a canonical claim fails.';
comment on function public.cla_recover_expired_learning_resource_claims(integer) is
  'Bounded service-only sweep that fails expired canonical claims; the failed-claim trigger returns stranded reservations.';

commit;
