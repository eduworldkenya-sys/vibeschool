begin;

alter table public.vibe_credit_transactions
  add column if not exists mpesa_amount_kes integer;

create unique index if not exists vibe_credit_transactions_mpesa_ref_uniq
  on public.vibe_credit_transactions (mpesa_ref)
  where mpesa_ref is not null;

-- Atomic, idempotent settlement boundary for the external M-Pesa callback.
-- Only service_role may execute this function. The pending transaction row is
-- locked before any wallet mutation, so duplicate callbacks cannot mint twice.
create or replace function public.settle_mpesa_credit(
  p_checkout_id text,
  p_mpesa_ref text,
  p_paid_amount_kes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_pending public.vibe_credit_transactions%rowtype;
  v_current_balance integer;
  v_new_balance integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if nullif(trim(p_checkout_id), '') is null
     or nullif(trim(p_mpesa_ref), '') is null
     or p_paid_amount_kes is null
     or p_paid_amount_kes <= 0 then
    raise exception 'invalid_mpesa_settlement';
  end if;

  select * into v_pending
  from public.vibe_credit_transactions
  where mpesa_ref = p_checkout_id
    and type = 'purchase'
    and feature = 'mpesa'
    and notes like 'PENDING — %'
  limit 1
  for update;

  if not found then
    if exists (
      select 1 from public.vibe_credit_transactions
      where mpesa_ref = p_mpesa_ref
    ) then
      return jsonb_build_object('ok', true, 'status', 'already_settled');
    end if;
    return jsonb_build_object('ok', false, 'status', 'pending_transaction_not_found');
  end if;

  if v_pending.mpesa_amount_kes is null
     or v_pending.mpesa_amount_kes <> p_paid_amount_kes then
    update public.vibe_credit_transactions
    set notes = 'FAILED — M-Pesa amount mismatch',
        updated_at = now()
    where id = v_pending.id;
    return jsonb_build_object(
      'ok', false,
      'status', 'amount_mismatch',
      'expected_amount_kes', v_pending.mpesa_amount_kes,
      'received_amount_kes', p_paid_amount_kes
    );
  end if;

  if exists (
    select 1 from public.vibe_credit_transactions
    where mpesa_ref = p_mpesa_ref
      and id <> v_pending.id
  ) then
    return jsonb_build_object('ok', true, 'status', 'already_settled');
  end if;

  select balance into v_current_balance
  from public.vibe_credits
  where teacher_id = v_pending.teacher_id
  for update;

  if not found then
    insert into public.vibe_credits(teacher_id,balance,total_earned,total_spent,updated_at)
    values(v_pending.teacher_id,0,0,0,now())
    on conflict (teacher_id) do nothing;
    select balance into v_current_balance
    from public.vibe_credits
    where teacher_id = v_pending.teacher_id
    for update;
  end if;

  v_new_balance := coalesce(v_current_balance,0) + v_pending.amount;

  update public.vibe_credits
  set balance = v_new_balance,
      total_earned = total_earned + v_pending.amount,
      updated_at = now()
  where teacher_id = v_pending.teacher_id;

  update public.vibe_credit_transactions
  set balance_after = v_new_balance,
      mpesa_ref = p_mpesa_ref,
      notes = replace(notes, 'PENDING — ', '') || ' [paid]',
      updated_at = now()
  where id = v_pending.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'settled',
    'teacher_id', v_pending.teacher_id,
    'credits_added', v_pending.amount,
    'balance_after', v_new_balance,
    'mpesa_ref', p_mpesa_ref
  );
end;
$function$;

revoke execute on function public.settle_mpesa_credit(text,text,integer) from public,anon,authenticated;
grant execute on function public.settle_mpesa_credit(text,text,integer) to service_role;
alter function public.settle_mpesa_credit(text,text,integer) set search_path = public, pg_temp;

commit;
