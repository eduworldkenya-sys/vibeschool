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
