-- Run ONLY after both disposable fixture and lifecycle SQL, never on production.
begin;
do $$
declare
  v_order uuid; v_same uuid; v_attempt uuid; v_second uuid;
  v_guest uuid; v_guest_attempt uuid; v_expired uuid; v_expired_attempt uuid;
  v_conflict uuid; v_conflict_attempt uuid;
  v_untrusted boolean := false;
  v_result text;
  v_item record;
begin
  -- Every product category resolves its price from the fixed server catalogue.
  for v_item in select * from commerce_sandbox.catalogue loop
    v_order := commerce_sandbox.create_trusted_order(
      v_item.product_kind,v_item.item_reference,'profile',
      'synthetic-profile-123','idem-product-'||v_item.product_kind||'-12345');
    if (select amount_kes from commerce_sandbox.orders where id=v_order)<>v_item.trusted_price_kes then
      raise exception 'product price not server-authoritative';
    end if;
  end loop;

  v_guest:=commerce_sandbox.create_trusted_order(
    'success_wish','sandbox-success-wish','guest',
    'verified-guest-123','guest-idempotency-12345');
  v_same:=commerce_sandbox.create_trusted_order(
    'success_wish','sandbox-success-wish','guest',
    'verified-guest-123','guest-idempotency-12345');
  if v_guest<>v_same then raise exception 'guest replay created a second order'; end if;
  begin
    perform commerce_sandbox.create_trusted_order(
      'learning_product','sandbox-learning-pack','guest',
      'verified-guest-123','guest-idempotency-12345');
    raise exception 'idempotency reused for different product';
  exception when raise_exception then
    if (select count(*) from commerce_sandbox.orders
       where owner_reference='verified-guest-123')<>1 then
      raise exception 'idempotency conflict altered orders';
    end if;
  end;

  v_guest_attempt:=commerce_sandbox.reserve_attempt(v_guest,'254712345678');
  v_second:=commerce_sandbox.reserve_attempt(v_guest,'254712345678');
  if v_guest_attempt<>v_second then raise exception 'duplicate STK reservation'; end if;
  begin
    perform commerce_sandbox.reserve_attempt(v_guest,'254712345679');
    raise exception 'different phone reused active attempt';
  exception when raise_exception then
    if (select phone from commerce_sandbox.payment_attempts where id=v_guest_attempt)<>'254712345678' then
      raise exception 'attempt phone changed';
    end if;
  end;

  -- Callback arrives BEFORE request id is attached: saved, not settled.
  insert into commerce_sandbox.provider_inbox(
    checkout_request_id,merchant_request_id,provider_event_key,
    result_code,paid_amount_kes,phone,provider_receipt
  ) values('ws_CO_SYNTHETIC123','merchant_SYNTHETIC123','event-synthetic-success-1',
    0,50,'254712345678','SIMULATEDRECEIPT1');
  if commerce_sandbox.reconcile_sandbox('ws_CO_SYNTHETIC123')
    <>'early_event_waiting_for_attachment' then
    raise exception 'early callback was not buffered';
  end if;
  if (select count(*) from commerce_sandbox.simulated_entitlements)<>0
    then raise exception 'early callback unlocked an entitlement'; end if;
  perform commerce_sandbox.attach_stk(
    v_guest_attempt,'ws_CO_SYNTHETIC123','merchant_SYNTHETIC123');
  -- Without trusted status query, a callback is NOT enough.
  if commerce_sandbox.reconcile_sandbox('ws_CO_SYNTHETIC123')<>'query_pending'
    then raise exception 'callback alone granted payment'; end if;
  insert into commerce_sandbox.provider_query_observations(
    checkout_request_id,merchant_request_id,result_code
  ) values('ws_CO_SYNTHETIC123','merchant_SYNTHETIC123',0);
  if commerce_sandbox.reconcile_sandbox('ws_CO_SYNTHETIC123')<>'settled_simulated'
    then raise exception 'verified synthetic settlement failed'; end if;
  if (select count(*) from commerce_sandbox.simulated_entitlements
       where order_id=v_guest)<>1 then
    raise exception 'missing simulated entitlement'; end if;
  if commerce_sandbox.reconcile_sandbox('ws_CO_SYNTHETIC123')<>'duplicate_settlement'
    then raise exception 'settlement replay granted twice'; end if;
  if (select count(*) from commerce_sandbox.simulated_entitlements
       where order_id=v_guest)<>1 then
    raise exception 'duplicated entitlement'; end if;
  -- An identical callback replay cannot duplicate event evidence.
  begin
    insert into commerce_sandbox.provider_inbox(
      checkout_request_id,merchant_request_id,provider_event_key,
      result_code,paid_amount_kes,phone,provider_receipt
    ) values('ws_CO_SYNTHETIC123','merchant_SYNTHETIC123','event-synthetic-success-1',
      0,50,'254712345678','SIMULATEDRECEIPT1');
    raise exception 'duplicated provider event key accepted';
  exception when unique_violation then null;
  end;

  -- The observed founder result 1037 becomes expired, never paid.
  v_expired:=commerce_sandbox.create_trusted_order(
    'learning_product','sandbox-learning-pack','profile',
    'founder-test-profile-1','timeout-idempotency-12345');
  v_expired_attempt:=commerce_sandbox.reserve_attempt(v_expired,'254712345678');
  perform commerce_sandbox.attach_stk(v_expired_attempt,
    'ws_CO_SYNTHETIC1037','merchant_SYNTHETIC1037');
  insert into commerce_sandbox.provider_query_observations(
    checkout_request_id,merchant_request_id,result_code
  ) values('ws_CO_SYNTHETIC1037','merchant_SYNTHETIC1037',1037);
  if commerce_sandbox.reconcile_sandbox('ws_CO_SYNTHETIC1037')<>'expired' then
    raise exception '1037 was not marked expired'; end if;
  if (select state from commerce_sandbox.payment_attempts where id=v_expired_attempt)<>'expired'
    then raise exception '1037 attempt not persisted as expired'; end if;
  if exists(select 1 from commerce_sandbox.simulated_entitlements
    where order_id=v_expired) then raise exception 'timeout granted entitlement'; end if;
  -- Fresh explicit attempt can be reserved on retry, but does not auto-submit provider request.
  v_second:=commerce_sandbox.reserve_attempt(v_expired,'254712345678');
  if v_second=v_expired_attempt then raise exception 'expired attempt got silently retried'; end if;

  -- Query success without matching amount+phone+receipt quarantines.
  v_conflict:=commerce_sandbox.create_trusted_order(
    'exam_access','sandbox-exam-access','profile',
    'exam-test-profile-1','conflict-idempotency-12345');
  v_conflict_attempt:=commerce_sandbox.reserve_attempt(v_conflict,'254712345678');
  perform commerce_sandbox.attach_stk(v_conflict_attempt,
    'ws_CO_SYNTHETICBAD','merchant_SYNTHETICBAD');
  insert into commerce_sandbox.provider_query_observations(
    checkout_request_id,merchant_request_id,result_code
  ) values('ws_CO_SYNTHETICBAD','merchant_SYNTHETICBAD',0);
  if commerce_sandbox.reconcile_sandbox('ws_CO_SYNTHETICBAD')<>'awaiting_callback_evidence'
    then raise exception 'query alone falsely settled'; end if;
  insert into commerce_sandbox.provider_inbox(
    checkout_request_id,merchant_request_id,provider_event_key,
    result_code,paid_amount_kes,phone,provider_receipt
  ) values('ws_CO_SYNTHETICBAD','merchant_SYNTHETICBAD','event-synthetic-tampered',
    0,1,'254712345679','FAKERECEIPT123');
  if commerce_sandbox.reconcile_sandbox('ws_CO_SYNTHETICBAD')<>'invalid_settlement_evidence'
    then raise exception 'tampered callback not quarantined'; end if;
  if (select state from commerce_sandbox.payment_attempts where id=v_conflict_attempt)
     <>'reconciliation_required' then raise exception 'missing quarantine state'; end if;
  if exists(select 1 from commerce_sandbox.simulated_entitlements where order_id=v_conflict)
    then raise exception 'tampered callback granted access'; end if;

  if has_schema_privilege('commerce_fixture_untrusted','commerce_sandbox','USAGE')
    or has_table_privilege('commerce_fixture_untrusted',
      'commerce_sandbox.simulated_entitlements','INSERT') then
    raise exception 'private sandbox tables were exposed to untrusted role';
  end if;
  raise notice 'PASS: six products, catalogue pricing, guest/owner idempotency, early callback, verified synthetic settlement, 1037, mismatches, no real entitlement';
end $$;
rollback;
