\set ON_ERROR_STOP on

begin;

-- Task 19 financial integrity certification. This suite is intentionally read-only
-- with respect to durable test state: all checks run inside a transaction and roll back.

do $$
declare v_table text; v_rls boolean;
begin
  foreach v_table in array array['commerce_financial_ledger','commerce_payment_receipts'] loop
    select c.relrowsecurity into v_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=v_table and c.relkind='r';
    if v_rls is distinct from true then raise exception 'task19: % missing or RLS disabled',v_table; end if;
    if has_table_privilege('anon',format('public.%I',v_table),'SELECT')
       or has_table_privilege('authenticated',format('public.%I',v_table),'SELECT')
       or has_table_privilege('anon',format('public.%I',v_table),'INSERT')
       or has_table_privilege('authenticated',format('public.%I',v_table),'INSERT') then
      raise exception 'task19: browser role can access raw financial evidence table %',v_table;
    end if;
  end loop;
end $$;

do $$
declare v_fn text; v_oid regprocedure; v_def text;
begin
  foreach v_fn in array array[
    'public.commerce_settle_verified_mpesa_attempt(uuid,uuid)',
    'public.process_commerce_payment_callback_event(uuid)',
    'public.commerce_reconcile_payment_attempt(uuid)',
    'public.commerce_get_my_payment_status(uuid)',
    'public.hq_payment_finance_overview(integer)',
    'public.commerce_fulfill_learning_product_order(uuid,text,text,numeric)'
  ] loop
    v_oid:=to_regprocedure(v_fn);
    if v_oid is null then raise exception 'task19: missing function %',v_fn; end if;
    select pg_get_functiondef(v_oid) into v_def;
    if v_def not like '%SET search_path TO ''''%' then raise exception 'task19: % lacks empty fixed search_path',v_fn; end if;
  end loop;
end $$;

-- No browser role may execute consequential settlement or reconciliation.
do $$
begin
  if has_function_privilege('anon','public.commerce_settle_verified_mpesa_attempt(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.commerce_settle_verified_mpesa_attempt(uuid,uuid)','EXECUTE') then
    raise exception 'task19: browser can settle payment';
  end if;
  if has_function_privilege('anon','public.commerce_reconcile_payment_attempt(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.commerce_reconcile_payment_attempt(uuid)','EXECUTE') then
    raise exception 'task19: browser can reconcile payment';
  end if;
  if not has_function_privilege('service_role','public.commerce_settle_verified_mpesa_attempt(uuid,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.commerce_reconcile_payment_attempt(uuid)','EXECUTE') then
    raise exception 'task19: service settlement/reconciliation unavailable';
  end if;
  if has_function_privilege('anon','public.commerce_get_my_payment_status(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.commerce_get_my_payment_status(uuid)','EXECUTE') then
    raise exception 'task19: self payment-status execution boundary incorrect';
  end if;
end $$;

-- Direct receipt-based fulfillment is closed; exact callback evidence is mandatory.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.commerce_fulfill_learning_product_order(uuid,text,text,numeric)'::regprocedure) into v_def;
  if v_def not like '%direct_fulfillment_disabled%' then
    raise exception 'task19: direct paid-entitlement fulfillment bypass remains open';
  end if;

  select pg_get_functiondef('public.commerce_settle_verified_mpesa_attempt(uuid,uuid)'::regprocedure) into v_def;
  if v_def not like '%commerce_payment_callback_events%'
     or v_def not like '%checkout_request_id is distinct from v_attempt.checkout_request_id%'
     or v_def not like '%merchant_request_mismatch%'
     or v_def not like '%amount_mismatch%'
     or v_def not like '%duplicate_provider_receipt%'
     or v_def not like '%commerce_financial_ledger%'
     or v_def not like '%commerce_payment_receipts%'
     or v_def not like '%learning_product_entitlements%' then
    raise exception 'task19: settlement gateway missing evidence/ledger/receipt/entitlement binding';
  end if;
end $$;

-- Crash safety: payment state, ledger, receipt and entitlement are one SQL transaction.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.process_commerce_payment_callback_event(uuid)'::regprocedure) into v_def;
  if v_def not like '%commerce_settle_verified_mpesa_attempt%'
     or v_def like '%commerce_fulfill_learning_product_order%' then
    raise exception 'task19: callback processing does not use canonical verified settlement gateway';
  end if;
  if v_def not like '%reconciliation_required%' or v_def not like '%terminal_callback_after_settlement%' then
    raise exception 'task19: callback contradiction handling incomplete';
  end if;
end $$;

-- Reconciliation must replay durable success evidence and never guess a stale pending payment as failed.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.commerce_reconcile_payment_attempt(uuid)'::regprocedure) into v_def;
  if v_def not like '%result_code=0%'
     or v_def not like '%process_commerce_payment_callback_event%'
     or v_def not like '%provider_confirmation_missing_after_threshold%'
     or v_def not like '%reconciliation_required%' then
    raise exception 'task19: deterministic reconciliation contract incomplete';
  end if;
end $$;

-- Ledger and receipts are append-only and unique by financial identity.
do $$
begin
  if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='commerce_financial_ledger' and t.tgname='commerce_financial_ledger_immutable' and not t.tgisinternal) then
    raise exception 'task19: ledger immutability trigger missing';
  end if;
  if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='commerce_payment_receipts' and t.tgname='commerce_payment_receipts_immutable' and not t.tgisinternal) then
    raise exception 'task19: receipt immutability trigger missing';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and tablename='commerce_financial_ledger' and indexdef like '%UNIQUE%' and indexdef like '%payment_attempt_id%entry_type%') then
    raise exception 'task19: ledger attempt idempotency uniqueness missing';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and tablename='commerce_payment_receipts' and indexdef like '%UNIQUE%' and indexdef like '%order_id%') then
    raise exception 'task19: one-receipt-per-order uniqueness missing';
  end if;
end $$;

-- User status projection must not leak phone or raw callback payload.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.commerce_get_my_payment_status(uuid)'::regprocedure) into v_def;
  if v_def like '%raw_payload%' or v_def like '%''phone''%' then
    raise exception 'task19: payment status projection exposes sensitive raw fields';
  end if;
  if v_def not like '%payer_profile_id=v_caller%' or v_def not like '%purchaser_profile_id=v_caller%' then
    raise exception 'task19: payment status lacks payer/order self authorization';
  end if;
end $$;

-- HQ revenue is ledger-derived, and initiated STKs remain a separate metric.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.hq_payment_finance_overview(integer)'::regprocedure) into v_def;
  if v_def not like '%is_platform_owner%'
     or v_def not like '%commerce_financial_ledger%'
     or v_def not like '%reconciled_revenue_kes%'
     or v_def not like '%initiated%'
     or v_def not like '%reconciliation_required%' then
    raise exception 'task19: HQ finance truth definitions incomplete';
  end if;
end $$;

-- Migration cannot activate payment initiation.
do $$
declare v_enabled boolean;
begin
  select initiation_enabled into v_enabled from public.mpesa_runtime_control where singleton=true;
  if coalesce(v_enabled,false) then raise exception 'task19: payment initiation unexpectedly enabled'; end if;
end $$;

rollback;
\echo 'Task 19 Payment Financial Integrity Contract: PASS'
