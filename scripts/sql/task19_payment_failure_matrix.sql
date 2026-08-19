\set ON_ERROR_STOP on
begin;

-- Transaction-local financial failure matrix. Every fixture is rolled back.
do $$
declare
  v_user uuid := '19000000-0000-4000-8000-000000000001';
  v_product uuid;
  v_offer uuid;
  v_order uuid;
  v_attempt uuid;
  v_event uuid;
  v_result jsonb;
  v_i integer;
  v_count integer;
  v_state text;
  v_order_state text;
  v_order2 uuid;
  v_attempt2 uuid;
  v_event2 uuid;
  v_order3 uuid;
  v_attempt3 uuid;
  v_event3 uuid;
  v_order4 uuid;
  v_attempt4 uuid;
  v_order5 uuid;
  v_attempt5 uuid;
  v_event5 uuid;
  v_order6 uuid;
  v_attempt6 uuid;
  v_event6 uuid;
begin
  -- Disposable auth/profile principal. Local Supabase auth schema accepts this
  -- minimal server-created user fixture; profile upsert tolerates auth hooks.
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_user,'authenticated','authenticated','task19-fixture@invalid.local','',now(),'{}'::jsonb,'{}'::jsonb,now(),now())
  on conflict(id) do nothing;

  insert into public.profiles(id,full_name,role,country_code)
  values(v_user,'Task 19 Fixture','student','KE')
  on conflict(id) do update set full_name=excluded.full_name;

  insert into public.learning_products(sku,product_type,title,status,rights_status)
  values('task19-fixture-product','ebook','Task 19 Fixture Product','active','cleared')
  returning id into v_product;

  insert into public.learning_product_offers(product_id,offer_key,pricing_model,amount_kes,access_days,status,terms_version)
  values(v_product,'task19-fixture-offer','one_time',100,30,'active','task19-v1')
  returning id into v_offer;

  -- 1) Successful callback then the same callback replayed five times.
  insert into public.learning_product_orders(
    purchaser_profile_id,beneficiary_profile_id,product_id,offer_id,currency,amount_kes,status,idempotency_key,
    product_snapshot,offer_snapshot,access_days_snapshot
  ) values(v_user,v_user,v_product,v_offer,'KES',100,'pending_payment','task19-success-order','{}','{}',30)
  returning id into v_order;

  insert into public.commerce_payment_attempts(
    order_id,payer_profile_id,provider,expected_amount_kes,phone,idempotency_key,state,merchant_request_id,checkout_request_id,requested_at
  ) values(v_order,v_user,'mpesa',100,'254700000001','task19-success-attempt','awaiting_customer','MERCHANT-19-1','CHECKOUT-19-1',now())
  returning id into v_attempt;

  insert into public.commerce_payment_callback_events(
    provider,event_key,checkout_request_id,merchant_request_id,result_code,result_desc,provider_receipt,paid_amount_kes,raw_payload
  ) values('mpesa','task19-success-event','CHECKOUT-19-1','MERCHANT-19-1',0,'Success','TASK19REC001',100,'{}')
  returning id into v_event;

  v_result := public.process_commerce_payment_callback_event(v_event);
  if coalesce((v_result->>'success')::boolean,false) is not true then raise exception 'task19 matrix: initial success did not settle: %',v_result; end if;
  for v_i in 1..5 loop
    v_result := public.process_commerce_payment_callback_event(v_event);
    if coalesce((v_result->>'success')::boolean,false) is not true then raise exception 'task19 matrix: replay % failed: %',v_i,v_result; end if;
  end loop;

  select count(*) into v_count from public.commerce_financial_ledger where payment_attempt_id=v_attempt;
  if v_count<>1 then raise exception 'task19 matrix: duplicate ledger effects: %',v_count; end if;
  select count(*) into v_count from public.commerce_payment_receipts where payment_attempt_id=v_attempt;
  if v_count<>1 then raise exception 'task19 matrix: duplicate receipts: %',v_count; end if;
  select count(*) into v_count from public.learning_product_entitlements where order_id=v_order;
  if v_count<>1 then raise exception 'task19 matrix: duplicate entitlements: %',v_count; end if;
  select state into v_state from public.commerce_payment_attempts where id=v_attempt;
  select status into v_order_state from public.learning_product_orders where id=v_order;
  if v_state<>'settled' or v_order_state<>'fulfilled' then raise exception 'task19 matrix: success state divergence attempt=% order=%',v_state,v_order_state; end if;

  -- 2) Customer cancellation cannot create a financial effect.
  insert into public.learning_product_orders(purchaser_profile_id,beneficiary_profile_id,product_id,offer_id,currency,amount_kes,status,idempotency_key,product_snapshot,offer_snapshot,access_days_snapshot)
  values(v_user,v_user,v_product,v_offer,'KES',100,'pending_payment','task19-cancel-order','{}','{}',30) returning id into v_order2;
  insert into public.commerce_payment_attempts(order_id,payer_profile_id,provider,expected_amount_kes,phone,idempotency_key,state,merchant_request_id,checkout_request_id,requested_at)
  values(v_order2,v_user,'mpesa',100,'254700000001','task19-cancel-attempt','awaiting_customer','MERCHANT-19-2','CHECKOUT-19-2',now()) returning id into v_attempt2;
  insert into public.commerce_payment_callback_events(provider,event_key,checkout_request_id,merchant_request_id,result_code,result_desc,raw_payload)
  values('mpesa','task19-cancel-event','CHECKOUT-19-2','MERCHANT-19-2',1032,'Request cancelled by user','{}') returning id into v_event2;
  perform public.process_commerce_payment_callback_event(v_event2);
  select state into v_state from public.commerce_payment_attempts where id=v_attempt2;
  if v_state<>'cancelled' then raise exception 'task19 matrix: cancellation state=%',v_state; end if;
  if exists(select 1 from public.commerce_financial_ledger where payment_attempt_id=v_attempt2)
     or exists(select 1 from public.commerce_payment_receipts where payment_attempt_id=v_attempt2)
     or exists(select 1 from public.learning_product_entitlements where order_id=v_order2) then
    raise exception 'task19 matrix: cancellation created financial effect';
  end if;

  -- 3) Provider success with wrong amount is quarantined for reconciliation.
  insert into public.learning_product_orders(purchaser_profile_id,beneficiary_profile_id,product_id,offer_id,currency,amount_kes,status,idempotency_key,product_snapshot,offer_snapshot,access_days_snapshot)
  values(v_user,v_user,v_product,v_offer,'KES',100,'pending_payment','task19-mismatch-order','{}','{}',30) returning id into v_order3;
  insert into public.commerce_payment_attempts(order_id,payer_profile_id,provider,expected_amount_kes,phone,idempotency_key,state,merchant_request_id,checkout_request_id,requested_at)
  values(v_order3,v_user,'mpesa',100,'254700000001','task19-mismatch-attempt','awaiting_customer','MERCHANT-19-3','CHECKOUT-19-3',now()) returning id into v_attempt3;
  insert into public.commerce_payment_callback_events(provider,event_key,checkout_request_id,merchant_request_id,result_code,result_desc,provider_receipt,paid_amount_kes,raw_payload)
  values('mpesa','task19-mismatch-event','CHECKOUT-19-3','MERCHANT-19-3',0,'Success','TASK19REC003',99,'{}') returning id into v_event3;
  v_result:=public.process_commerce_payment_callback_event(v_event3);
  if v_result->>'error'<>'amount_mismatch' then raise exception 'task19 matrix: amount mismatch not rejected: %',v_result; end if;
  select state into v_state from public.commerce_payment_attempts where id=v_attempt3;
  if v_state<>'reconciliation_required' then raise exception 'task19 matrix: mismatch state=%',v_state; end if;
  if exists(select 1 from public.commerce_financial_ledger where payment_attempt_id=v_attempt3)
     or exists(select 1 from public.learning_product_entitlements where order_id=v_order3) then
    raise exception 'task19 matrix: amount mismatch created financial effect';
  end if;

  -- 4) Stale unresolved STK becomes reconciliation-required, never guessed paid/failed.
  insert into public.learning_product_orders(purchaser_profile_id,beneficiary_profile_id,product_id,offer_id,currency,amount_kes,status,idempotency_key,product_snapshot,offer_snapshot,access_days_snapshot)
  values(v_user,v_user,v_product,v_offer,'KES',100,'pending_payment','task19-timeout-order','{}','{}',30) returning id into v_order4;
  insert into public.commerce_payment_attempts(order_id,payer_profile_id,provider,expected_amount_kes,phone,idempotency_key,state,merchant_request_id,checkout_request_id,requested_at)
  values(v_order4,v_user,'mpesa',100,'254700000001','task19-timeout-attempt','awaiting_customer','MERCHANT-19-4','CHECKOUT-19-4',now()-interval '20 minutes') returning id into v_attempt4;
  v_result:=public.commerce_reconcile_payment_attempt(v_attempt4);
  select state into v_state from public.commerce_payment_attempts where id=v_attempt4;
  if v_state<>'reconciliation_required' or v_result->>'error'<>'provider_confirmation_missing' then
    raise exception 'task19 matrix: timeout guessed state result=% state=%',v_result,v_state;
  end if;

  -- 5) Callback arrives before CheckoutRequestID is attached: durable evidence is replayed on attach.
  insert into public.learning_product_orders(purchaser_profile_id,beneficiary_profile_id,product_id,offer_id,currency,amount_kes,status,idempotency_key,product_snapshot,offer_snapshot,access_days_snapshot)
  values(v_user,v_user,v_product,v_offer,'KES',100,'pending_payment','task19-early-order','{}','{}',30) returning id into v_order5;
  insert into public.commerce_payment_attempts(order_id,payer_profile_id,provider,expected_amount_kes,phone,idempotency_key,state,requested_at)
  values(v_order5,v_user,'mpesa',100,'254700000001','task19-early-attempt','submitting',now()) returning id into v_attempt5;
  insert into public.commerce_payment_callback_events(provider,event_key,checkout_request_id,merchant_request_id,result_code,result_desc,provider_receipt,paid_amount_kes,raw_payload)
  values('mpesa','task19-early-event','CHECKOUT-19-5','MERCHANT-19-5',0,'Success','TASK19REC005',100,'{}') returning id into v_event5;
  v_result:=public.process_commerce_payment_callback_event(v_event5);
  if v_result->>'error'<>'attempt_not_found' then raise exception 'task19 matrix: pre-attach callback unexpectedly matched: %',v_result; end if;
  v_result:=public.attach_commerce_mpesa_request(v_attempt5,'CHECKOUT-19-5','MERCHANT-19-5','{}');
  select state into v_state from public.commerce_payment_attempts where id=v_attempt5;
  if v_state<>'settled' or v_result->>'state'<>'settled' or v_result->>'early_callback_replayed'<>'true' then
    raise exception 'task19 matrix: early callback did not converge result=% state=%',v_result,v_state;
  end if;
  select count(*) into v_count from public.learning_product_entitlements where order_id=v_order5;
  if v_count<>1 then raise exception 'task19 matrix: early callback entitlement count=%',v_count; end if;

  -- 6) Simulated receipt-store failure proves settlement atomicity; replay after repair settles exactly once.
  insert into public.learning_product_orders(purchaser_profile_id,beneficiary_profile_id,product_id,offer_id,currency,amount_kes,status,idempotency_key,product_snapshot,offer_snapshot,access_days_snapshot)
  values(v_user,v_user,v_product,v_offer,'KES',100,'pending_payment','task19-crash-order','{}','{}',30) returning id into v_order6;
  insert into public.commerce_payment_attempts(order_id,payer_profile_id,provider,expected_amount_kes,phone,idempotency_key,state,merchant_request_id,checkout_request_id,requested_at)
  values(v_order6,v_user,'mpesa',100,'254700000001','task19-crash-attempt','awaiting_customer','MERCHANT-19-6','CHECKOUT-19-6',now()) returning id into v_attempt6;
  insert into public.commerce_payment_callback_events(provider,event_key,checkout_request_id,merchant_request_id,result_code,result_desc,provider_receipt,paid_amount_kes,raw_payload)
  values('mpesa','task19-crash-event','CHECKOUT-19-6','MERCHANT-19-6',0,'Success','TASK19REC006',100,'{}') returning id into v_event6;

  create temporary table task19_fault_guard(enabled boolean not null);
  insert into task19_fault_guard values(true);
  create or replace function pg_temp.task19_fail_receipt_insert() returns trigger language plpgsql as $fault$
  begin
    if exists(select 1 from task19_fault_guard where enabled) then raise exception 'task19_injected_receipt_failure'; end if;
    return new;
  end;$fault$;
  create trigger task19_fail_receipt before insert on public.commerce_payment_receipts
  for each row execute function pg_temp.task19_fail_receipt_insert();

  begin
    perform public.process_commerce_payment_callback_event(v_event6);
    raise exception 'task19 matrix: injected receipt failure did not abort settlement';
  exception when others then
    if sqlerrm <> 'task19_injected_receipt_failure' then raise; end if;
  end;

  if exists(select 1 from public.commerce_financial_ledger where payment_attempt_id=v_attempt6)
     or exists(select 1 from public.commerce_payment_receipts where payment_attempt_id=v_attempt6)
     or exists(select 1 from public.learning_product_entitlements where order_id=v_order6) then
    raise exception 'task19 matrix: failed settlement committed partial financial effect';
  end if;
  select state into v_state from public.commerce_payment_attempts where id=v_attempt6;
  if v_state<>'awaiting_customer' then raise exception 'task19 matrix: failed settlement mutated attempt state=%',v_state; end if;

  update task19_fault_guard set enabled=false;
  v_result:=public.process_commerce_payment_callback_event(v_event6);
  if coalesce((v_result->>'success')::boolean,false) is not true then raise exception 'task19 matrix: recovery replay failed: %',v_result; end if;
  perform public.process_commerce_payment_callback_event(v_event6); -- response-loss replay after full commit

  select count(*) into v_count from public.commerce_financial_ledger where payment_attempt_id=v_attempt6;
  if v_count<>1 then raise exception 'task19 matrix: recovery ledger count=%',v_count; end if;
  select count(*) into v_count from public.commerce_payment_receipts where payment_attempt_id=v_attempt6;
  if v_count<>1 then raise exception 'task19 matrix: recovery receipt count=%',v_count; end if;
  select count(*) into v_count from public.learning_product_entitlements where order_id=v_order6;
  if v_count<>1 then raise exception 'task19 matrix: recovery entitlement count=%',v_count; end if;
end $$;

rollback;
\echo 'Task 19 Payment Failure Matrix: PASS'
