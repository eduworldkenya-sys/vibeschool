-- Synthetic PostgreSQL fixture only. This tests SQL settlement rules; it does NOT certify M-Pesa.
insert into public.learning_product_orders(id,amount_kes,status,product_snapshot) values
 ('30000000-0000-4000-8000-000000000001',50,'paid','{"kind":"success_wish_text"}'),
 ('30000000-0000-4000-8000-000000000002',50,'paid','{"kind":"learning_product"}'),
 ('30000000-0000-4000-8000-000000000003',50,'paid','{"kind":"success_wish_text"}');
insert into public.commerce_payment_attempts
 (id,order_id,provider,state,provider_result_code,provider_receipt,settled_at,callback_received_at,expected_amount_kes)
values
 ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','mpesa','settled',0,'TEST-RECEIPT-ONLY',now(),now(),50),
 ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','mpesa','settled',0,'TEST-WRONG-PRODUCT',now(),now(),50),
 ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','mpesa','settled_simulated',0,'TEST-SIMULATED',now(),now(),50);

insert into public.success_wish_receivers (id,student_id,display_name,school_label,phone_e164,consent_status)
values
 ('50000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Alice Wanjiku','School Alpha','+254712345678','verified'),
 ('50000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Brian Otieno','School Beta','+254712345678','verified');

insert into public.success_wish_cards
 (id,receiver_id,payment_attempt_id,theme,sender_name,message,exam_year,expires_at)
values
 ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001','heritage','Mum','You have prepared well. We believe in you!','2026',now()+interval '30 days');

do $$
begin
  if (select count(*) from public.success_wish_receivers where phone_e164='+254712345678')<>2
    then raise exception 'Shared phone must permit two distinct student identities'; end if;
  if (select count(*) from public.success_wish_cards where receiver_id='50000000-0000-4000-8000-000000000001')<>1
    then raise exception 'Recipient ownership failed'; end if;
  if (select count(*) from public.success_wish_cards where receiver_id='50000000-0000-4000-8000-000000000002')<>0
    then raise exception 'Sibling saw another sibling card'; end if;

  begin
    insert into public.success_wish_cards(receiver_id,payment_attempt_id,theme,sender_name,message,exam_year,expires_at)
    values ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',
    'heritage','Test','This must not be issued','2026',now()+interval '30 days');
    raise exception 'Unrelated learning product could be used to claim a paid Success Wish';
  exception when check_violation then null; end;

  begin
    insert into public.success_wish_cards(receiver_id,payment_attempt_id,theme,sender_name,message,exam_year,expires_at)
    values ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003',
    'heritage','Test','This simulated settlement must not be issued','2026',now()+interval '30 days');
    raise exception 'Simulated settlement was accepted as real';
  exception when check_violation then null; end;

  begin
    insert into public.success_wish_cards(receiver_id,payment_attempt_id,theme,sender_name,message,exam_year,expires_at)
    values ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
    'heritage','Test','Duplicated card should not exist','2026',now()+interval '30 days');
    raise exception 'Duplicate callback could issue a duplicate card';
  exception when unique_violation then null; end;
end $$;

-- Verify the trusted issuance function returns secrets once and only stores their digests.
insert into public.learning_product_orders(id,amount_kes,status,product_snapshot)
values ('30000000-0000-4000-8000-000000000004',50,'paid','{"kind":"success_wish_text"}');
insert into public.commerce_payment_attempts
 (id,order_id,provider,state,provider_result_code,provider_receipt,settled_at,callback_received_at,expected_amount_kes)
values ('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004',
 'mpesa','settled',0,'TEST-RECEIPT-ISSUER',now(),now(),50);
do $$
declare first_issued record;
declare again record;
declare stored record;
begin
  select * into first_issued from public.success_wish_issue_verified_paid_card(
    '40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002',
    'botanical','Dad','I am so proud of your hard work.','2026',false
  );
  if not first_issued.newly_issued or first_issued.issued_card_id is null
    or first_issued.link_secret !~ '^[a-f0-9]{64}$'
    or first_issued.access_code !~ '^[0-9A-F]{32}
  then raise exception 'Real paid issue did not return guarded high-entropy credentials'; end if;

  select link_hash,code_hash into stored
  from public.success_wish_card_access where card_id=first_issued.issued_card_id;
  if stored.link_hash <> encode(extensions.digest('success-wishes:paid-link:' || first_issued.link_secret,'sha256'),'hex')
    or stored.code_hash <> encode(extensions.digest('success-wishes:paid-code:' || first_issued.access_code,'sha256'),'hex')
  then raise exception 'Card capability digests did not match issued credentials'; end if;

  select * into again from public.success_wish_issue_verified_paid_card(
    '40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002',
    'botanical','Dad','I am so proud of your hard work.','2026',false
  );
  if again.issued_card_id <> first_issued.issued_card_id
    or again.newly_issued or again.link_secret is not null or again.access_code is not null
  then raise exception 'Repeated real settlement issued another gift or exposed prior code'; end if;

  begin
    perform * from public.success_wish_issue_verified_paid_card(
      '40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000001',
      'botanical','Dad','Wrong receiver','2026',false
    );
    raise exception 'Duplicate payment was rebound to a different student';
  exception when check_violation then null; end;
end $$;

    or first_issued.access_code !~ '[A-Z]'
    or first_issued.access_code !~ '[0-9]'
  then raise exception 'Real paid issue did not return guarded high-entropy credentials'; end if;

  select link_hash,code_hash into stored
  from public.success_wish_card_access where card_id=first_issued.issued_card_id;
  if stored.link_hash <> encode(extensions.digest('success-wishes:paid-link:' || first_issued.link_secret,'sha256'),'hex')
    or stored.code_hash <> encode(extensions.digest('success-wishes:paid-code:' || first_issued.access_code,'sha256'),'hex')
  then raise exception 'Card capability digests did not match issued credentials'; end if;

  select * into again from public.success_wish_issue_verified_paid_card(
    '40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002',
    'botanical','Dad','I am so proud of your hard work.','2026',false
  );
  if again.issued_card_id <> first_issued.issued_card_id
    or again.newly_issued or again.link_secret is not null or again.access_code is not null
  then raise exception 'Repeated real settlement issued another gift or exposed prior code'; end if;

  begin
    perform * from public.success_wish_issue_verified_paid_card(
      '40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000001',
      'botanical','Dad','Wrong receiver','2026',false
    );
    raise exception 'Duplicate payment was rebound to a different student';
  exception when check_violation then null; end;
end $$;

  then raise exception 'Real paid issue did not return guarded high-entropy credentials'; end if;

  select link_hash,code_hash into stored
  from public.success_wish_card_access where card_id=first_issued.issued_card_id;
  if stored.link_hash <> encode(extensions.digest('success-wishes:paid-link:' || first_issued.link_secret,'sha256'),'hex')
    or stored.code_hash <> encode(extensions.digest('success-wishes:paid-code:' || first_issued.access_code,'sha256'),'hex')
  then raise exception 'Card capability digests did not match issued credentials'; end if;

  select * into again from public.success_wish_issue_verified_paid_card(
    '40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002',
    'botanical','Dad','I am so proud of your hard work.','2026',false
  );
  if again.issued_card_id <> first_issued.issued_card_id
    or again.newly_issued or again.link_secret is not null or again.access_code is not null
  then raise exception 'Repeated real settlement issued another gift or exposed prior code'; end if;

  begin
    perform * from public.success_wish_issue_verified_paid_card(
      '40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000001',
      'botanical','Dad','Wrong receiver','2026',false
    );
    raise exception 'Duplicate payment was rebound to a different student';
  exception when check_violation then null; end;
end $$;

    or first_issued.access_code !~ '[A-Z]'
    or first_issued.access_code !~ '[0-9]'
  then raise exception 'Real paid issue did not return guarded high-entropy credentials'; end if;

  select link_hash,code_hash into stored
  from public.success_wish_card_access where card_id=first_issued.issued_card_id;
  if stored.link_hash <> encode(extensions.digest('success-wishes:paid-link:' || first_issued.link_secret,'sha256'),'hex')
    or stored.code_hash <> encode(extensions.digest('success-wishes:paid-code:' || first_issued.access_code,'sha256'),'hex')
  then raise exception 'Card capability digests did not match issued credentials'; end if;

  select * into again from public.success_wish_issue_verified_paid_card(
    '40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002',
    'botanical','Dad','I am so proud of your hard work.','2026',false
  );
  if again.issued_card_id <> first_issued.issued_card_id
    or again.newly_issued or again.link_secret is not null or again.access_code is not null
  then raise exception 'Repeated real settlement issued another gift or exposed prior code'; end if;

  begin
    perform * from public.success_wish_issue_verified_paid_card(
      '40000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000001',
      'botanical','Dad','Wrong receiver','2026',false
    );
    raise exception 'Duplicate payment was rebound to a different student';
  exception when check_violation then null; end;
end $$;
