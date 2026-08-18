-- R3.6 canonical generation credit reservation.
-- One claimed curriculum gap must reserve one Vibe Credit before any external
-- research/model spend. Failed generation returns the reservation exactly once.

begin;

alter table public.learning_resource_generation_claims
  add column if not exists credit_reserved integer not null default 0,
  add column if not exists credit_reserved_at timestamptz,
  add column if not exists credit_refunded_at timestamptz;

alter table public.learning_resource_generation_claims
  drop constraint if exists learning_resource_generation_claims_credit_reserved_check,
  add constraint learning_resource_generation_claims_credit_reserved_check
    check (credit_reserved between 0 and 1),
  drop constraint if exists learning_resource_generation_claims_credit_timestamps_check,
  add constraint learning_resource_generation_claims_credit_timestamps_check
    check (
      (credit_reserved = 0 and credit_reserved_at is null and credit_refunded_at is null)
      or
      (credit_reserved = 1 and credit_reserved_at is not null)
    );

create or replace function public.cla_reserve_learning_resource_credit(
  p_claim_id uuid,
  p_amount integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.learning_resource_generation_claims%rowtype;
  v_wallet public.vibe_credits%rowtype;
  v_inserted_count integer := 0;
  v_new_balance integer;
begin
  if p_amount <> 1 then
    raise exception using errcode='22023', message='CLA_CREDIT_RESERVATION_AMOUNT_INVALID';
  end if;

  select * into v_claim
  from public.learning_resource_generation_claims
  where id = p_claim_id
  for update;

  if v_claim.id is null then
    raise exception using errcode='P0002', message='CLA_CLAIM_NOT_FOUND';
  end if;
  if v_claim.status <> 'claimed' or v_claim.expires_at <= now() then
    raise exception using errcode='23514', message='CLA_CLAIM_NOT_ACTIVE';
  end if;
  if v_claim.requested_by is null then
    raise exception using errcode='23514', message='CLA_CLAIM_REQUESTER_REQUIRED';
  end if;

  if v_claim.credit_reserved = 1 then
    return jsonb_build_object(
      'success', true,
      'already_reserved', true,
      'balance', (
        select vc.balance from public.vibe_credits vc
        where vc.teacher_id = v_claim.requested_by
      )
    );
  end if;

  insert into public.vibe_credits(
    teacher_id, balance, total_earned, total_spent
  ) values (
    v_claim.requested_by, 3, 3, 0
  )
  on conflict (teacher_id) do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 1 then
    insert into public.vibe_credit_transactions(
      teacher_id, type, feature, amount, balance_after, notes
    ) values (
      v_claim.requested_by,
      'gift',
      'signup_bonus',
      3,
      3,
      'Free credits on first AI use'
    );
  end if;

  select * into v_wallet
  from public.vibe_credits
  where teacher_id = v_claim.requested_by
  for update;

  if v_wallet.teacher_id is null then
    raise exception using errcode='P0001', message='CLA_CREDIT_WALLET_UNAVAILABLE';
  end if;

  if v_wallet.balance < p_amount then
    return jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_wallet.balance
    );
  end if;

  v_new_balance := v_wallet.balance - p_amount;

  update public.vibe_credits
  set balance = v_new_balance,
      total_spent = total_spent + p_amount,
      updated_at = now()
  where teacher_id = v_claim.requested_by;

  insert into public.vibe_credit_transactions(
    teacher_id, type, feature, amount, balance_after, notes
  ) values (
    v_claim.requested_by,
    'spend',
    'canonical_lesson_plan_gap',
    -p_amount,
    v_new_balance,
    'Reserved for first canonical candidate generation'
  );

  update public.learning_resource_generation_claims
  set credit_reserved = p_amount,
      credit_reserved_at = now(),
      updated_at = now()
  where id = p_claim_id;

  return jsonb_build_object(
    'success', true,
    'already_reserved', false,
    'balance', v_new_balance
  );
end;
$$;

create or replace function public.cla_refund_learning_resource_credit(
  p_claim_id uuid,
  p_reason text default 'generation_failed'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.learning_resource_generation_claims%rowtype;
  v_wallet public.vibe_credits%rowtype;
  v_new_balance integer;
begin
  select * into v_claim
  from public.learning_resource_generation_claims
  where id = p_claim_id
  for update;

  if v_claim.id is null then
    raise exception using errcode='P0002', message='CLA_CLAIM_NOT_FOUND';
  end if;

  if v_claim.credit_reserved = 0 or v_claim.credit_refunded_at is not null then
    return jsonb_build_object('refunded', false, 'reason', 'nothing_to_refund');
  end if;

  if v_claim.status = 'completed' then
    return jsonb_build_object('refunded', false, 'reason', 'claim_completed');
  end if;

  select * into v_wallet
  from public.vibe_credits
  where teacher_id = v_claim.requested_by
  for update;

  if v_wallet.teacher_id is null then
    raise exception using errcode='P0001', message='CLA_CREDIT_WALLET_UNAVAILABLE';
  end if;

  v_new_balance := v_wallet.balance + v_claim.credit_reserved;

  update public.vibe_credits
  set balance = v_new_balance,
      total_spent = greatest(0, total_spent - v_claim.credit_reserved),
      updated_at = now()
  where teacher_id = v_claim.requested_by;

  insert into public.vibe_credit_transactions(
    teacher_id, type, feature, amount, balance_after, notes
  ) values (
    v_claim.requested_by,
    'refund',
    'canonical_lesson_plan_gap',
    v_claim.credit_reserved,
    v_new_balance,
    left('Canonical generation refund: ' || coalesce(p_reason, 'generation_failed'), 500)
  );

  update public.learning_resource_generation_claims
  set credit_refunded_at = now(),
      updated_at = now()
  where id = p_claim_id;

  return jsonb_build_object('refunded', true, 'balance', v_new_balance);
end;
$$;

revoke all on function public.cla_reserve_learning_resource_credit(uuid,integer)
  from public, anon, authenticated;
revoke all on function public.cla_refund_learning_resource_credit(uuid,text)
  from public, anon, authenticated;
grant execute on function public.cla_reserve_learning_resource_credit(uuid,integer)
  to service_role;
grant execute on function public.cla_refund_learning_resource_credit(uuid,text)
  to service_role;

comment on function public.cla_reserve_learning_resource_credit(uuid,integer) is
  'Atomically reserves exactly one Vibe Credit against an active canonical generation claim before external research/model spend.';
comment on function public.cla_refund_learning_resource_credit(uuid,text) is
  'Returns an uncommitted canonical generation credit exactly once when generation fails before candidate deposit.';

commit;
