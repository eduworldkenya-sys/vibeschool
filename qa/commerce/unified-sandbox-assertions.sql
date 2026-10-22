-- Requires qa/commerce/unified-sandbox-fixture.sql first.
-- All rows, identities, phones, amounts and receipts are fictitious.
begin;
create role commerce_fixture_untrusted nologin;

do $$
declare
  o uuid;
  a uuid;
  kinds text[] := array[
    'teacher_credits','learning_product','exam_access','success_wish',
    'school_subscription','premium_feature'
  ];
  k text;
  n integer := 0;
begin
  if has_schema_privilege('commerce_fixture_untrusted','commerce_sandbox','USAGE') then
    raise exception 'untrusted role may use sandbox commerce schema';
  end if;
  if has_table_privilege('commerce_fixture_untrusted','commerce_sandbox.orders','SELECT') then
    raise exception 'untrusted role may query sandbox orders';
  end if;
  if (select count(*) from pg_class c join pg_namespace s on s.oid=c.relnamespace
      where s.nspname='commerce_sandbox' and c.relkind='r' and c.relrowsecurity) <> 3 then
    raise exception 'sandbox tables must enforce RLS';
  end if;

  foreach k in array kinds loop
    n:=n+1;
    insert into commerce_sandbox.orders(
      product_kind,item_reference,owner_type,owner_reference,amount_kes,idempotency_key
    ) values(k,'synthetic-item-'||n,'guest','guest-test-001',50+n,'idempotency-fixture-'||n);
  end loop;
  if (select count(*) from commerce_sandbox.orders) <> 6 then
    raise exception 'all six product kinds must be storable';
  end if;
  insert into commerce_sandbox.orders(
    product_kind,item_reference,owner_type,owner_reference,amount_kes,idempotency_key
  ) values('learning_product','form4-textbook','profile','teacher-test-001',300,'idempotency-profile-1')
  returning id into o;

  begin
    insert into commerce_sandbox.orders(
      product_kind,item_reference,owner_type,owner_reference,amount_kes,idempotency_key
    ) values('learning_product','form4-textbook','profile','teacher-test-001',300,'idempotency-profile-1');
    raise exception 'duplicate checkout unexpectedly accepted';
  exception when unique_violation then null;
  end;

  begin
    update commerce_sandbox.orders set amount_kes=1 where id=o;
    raise exception 'order price unexpectedly changed';
  exception when raise_exception then
    if (select amount_kes from commerce_sandbox.orders where id=o) <> 300 then
      raise exception 'economic terms were changed';
    end if;
  end;

  begin
    insert into commerce_sandbox.payment_attempts(order_id,amount_kes,phone)
      values(o,1,'254712345678');
    raise exception 'mismatched amount unexpectedly accepted';
  exception when raise_exception then
    if (select count(*) from commerce_sandbox.payment_attempts where order_id=o) <> 0 then
      raise exception 'mismatched attempt persisted';
    end if;
  end;

  insert into commerce_sandbox.payment_attempts(order_id,amount_kes,phone)
    values(o,300,'254712345678') returning id into a;
  begin
    insert into commerce_sandbox.payment_attempts(order_id,amount_kes,phone)
      values(o,300,'254712345678');
    raise exception 'second unresolved attempt unexpectedly accepted';
  exception when unique_violation then null;
  end;

  insert into commerce_sandbox.callback_events(
    attempt_id,provider_event_key,checkout_request_id,result_code,amount_kes,phone,receipt
  ) values(a,'sandbox_event_001','ws_CO_123456',0,300,'254712345678','TESTONLY001');

  begin
    insert into commerce_sandbox.callback_events(
      attempt_id,provider_event_key,checkout_request_id,result_code,amount_kes,phone,receipt
    ) values(a,'sandbox_event_001','ws_CO_123456',0,300,'254712345678','TESTONLY001');
    raise exception 'duplicate callback unexpectedly accepted';
  exception when unique_violation then null;
  end;

  begin
    update commerce_sandbox.callback_events set result_code=1
      where provider_event_key='sandbox_event_001';
    raise exception 'callback mutation unexpectedly accepted';
  exception when raise_exception then
    if (select result_code from commerce_sandbox.callback_events
        where provider_event_key='sandbox_event_001') <> 0 then
      raise exception 'callback evidence was mutated';
    end if;
  end;
  raise notice 'PASS: all six kinds, guest/profile ownership, price lock, dedupe, append-only, schema access and RLS';
end $$;
rollback;
