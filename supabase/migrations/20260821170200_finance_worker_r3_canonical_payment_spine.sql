-- Production/repository ledger parity for Priority 4.
-- Keeps Finance R3 qualification on reconstructible canonical payment tables only.
-- NON-ACTIVATING: no authority or financial data mutation.

create or replace function public.hq_workforce_finance_readonly_snapshot()
returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'payment_attempt_count',(select count(*) from public.commerce_payment_attempts),
    'payment_attempt_expected_kes',(select coalesce(sum(expected_amount_kes),0) from public.commerce_payment_attempts),
    'payment_attempt_settled_count',(select count(*) from public.commerce_payment_attempts where settled_at is not null),
    'finance_payment_count',(select count(*) from public.finance_payments where deleted_at is null),
    'finance_payment_total',(select coalesce(sum(amount),0) from public.finance_payments where deleted_at is null),
    'decision','reconcile_and_escalate_only','financial_mutation',false,
    'spend_authority',false,'settlement_authority',false,'refund_authority',false,
    'credit_authority',false,'wallet_mutation_authority',false,
    'human_approval_required',true,'side_effects_applied',false,
    'handler','finance.reconciliation.readonly'
  );
$$;
revoke all on function public.hq_workforce_finance_readonly_snapshot() from public,anon,authenticated;
grant execute on function public.hq_workforce_finance_readonly_snapshot() to service_role;

create or replace function public.hq_workforce_finance_state_digest()
returns text language sql security definer set search_path=public,pg_temp stable as $$
  select md5(concat_ws('|',
    (select count(*) from public.commerce_payment_attempts),
    (select coalesce(sum(expected_amount_kes),0) from public.commerce_payment_attempts),
    (select count(*) from public.commerce_payment_callback_events),
    (select count(*) from public.finance_payments),
    (select coalesce(sum(amount),0) from public.finance_payments)
  ));
$$;
revoke all on function public.hq_workforce_finance_state_digest() from public,anon,authenticated;
grant execute on function public.hq_workforce_finance_state_digest() to service_role;
