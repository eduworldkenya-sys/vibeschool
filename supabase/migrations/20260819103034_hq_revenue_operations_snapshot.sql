-- Owner-only commerce/revenue operational truth. Aggregate only; no payer PII and no mutation.
create or replace function public.hq_revenue_operations_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare mp public.mpesa_runtime_control%rowtype;
begin
  perform public.hq_assert_owner();
  select * into mp from public.mpesa_runtime_control where singleton=true;
  return jsonb_build_object(
    'observed_at',clock_timestamp(),
    'mpesa',jsonb_build_object(
      'initiation_enabled',coalesce(mp.initiation_enabled,false),
      'activated_at',mp.activated_at,
      'updated_at',mp.updated_at
    ),
    'orders',jsonb_build_object(
      'total',(select count(*) from public.learning_product_orders),
      'initiated',(select count(*) from public.learning_product_orders where status in ('initiated','pending')),
      'paid',(select count(*) from public.learning_product_orders where paid_at is not null),
      'fulfilled',(select count(*) from public.learning_product_orders where fulfilled_at is not null),
      'cancelled',(select count(*) from public.learning_product_orders where cancelled_at is not null),
      'refunded',(select count(*) from public.learning_product_orders where refunded_at is not null),
      'paid_not_fulfilled',(select count(*) from public.learning_product_orders where paid_at is not null and fulfilled_at is null and cancelled_at is null and refunded_at is null)
    ),
    'payment_attempts',jsonb_build_object(
      'total',(select count(*) from public.commerce_payment_attempts),
      'requested_7d',(select count(*) from public.commerce_payment_attempts where requested_at>=clock_timestamp()-interval '7 days'),
      'callback_received_7d',(select count(*) from public.commerce_payment_attempts where callback_received_at>=clock_timestamp()-interval '7 days'),
      'settled_7d',(select count(*) from public.commerce_payment_attempts where settled_at>=clock_timestamp()-interval '7 days'),
      'processing_errors_7d',(select count(*) from public.commerce_payment_attempts where processing_error is not null and updated_at>=clock_timestamp()-interval '7 days'),
      'callback_missing_over_15m',(select count(*) from public.commerce_payment_attempts where requested_at<clock_timestamp()-interval '15 minutes' and callback_received_at is null and settled_at is null)
    ),
    'callbacks',jsonb_build_object(
      'total',(select count(*) from public.commerce_payment_callback_events),
      'received_7d',(select count(*) from public.commerce_payment_callback_events where received_at>=clock_timestamp()-interval '7 days'),
      'processing_errors_7d',(select count(*) from public.commerce_payment_callback_events where processing_error is not null and received_at>=clock_timestamp()-interval '7 days'),
      'unprocessed',(select count(*) from public.commerce_payment_callback_events where processed_at is null)
    ),
    'entitlements',jsonb_build_object(
      'total',(select count(*) from public.learning_product_entitlements),
      'active',(select count(*) from public.learning_product_entitlements where status='active' and revoked_at is null and starts_at<=clock_timestamp() and (ends_at is null or ends_at>clock_timestamp())),
      'revoked',(select count(*) from public.learning_product_entitlements where revoked_at is not null or status='revoked')
    ),
    'subscriptions',jsonb_build_object(
      'active',(select count(*) from public.billing_subscriptions where status='active'),
      'trialing',(select count(*) from public.billing_subscriptions where status='trialing'),
      'past_due',(select count(*) from public.billing_subscriptions where status='past_due')
    ),
    'reconciliation',jsonb_build_object(
      'callback_without_attempt',(select count(*) from public.commerce_payment_callback_events c where not exists(select 1 from public.commerce_payment_attempts a where a.checkout_request_id=c.checkout_request_id)),
      'paid_without_entitlement',(select count(*) from public.learning_product_orders o where o.paid_at is not null and not exists(select 1 from public.learning_product_entitlements e where e.order_id=o.id and e.revoked_at is null))
    )
  );
end $$;
revoke all on function public.hq_revenue_operations_snapshot() from public,anon,service_role;
grant execute on function public.hq_revenue_operations_snapshot() to authenticated;
comment on function public.hq_revenue_operations_snapshot() is 'Owner-only aggregate revenue and M-Pesa operational truth; distinguishes initiation, callback, settlement, fulfillment and entitlement.';
