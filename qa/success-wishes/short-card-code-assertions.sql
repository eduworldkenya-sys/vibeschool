-- SYNTHETIC ONLY: checks newly issued six-character codes after the migration.
begin;
insert into public.success_wish_receivers
(id,display_name,school_label,phone_e164,consent_status)
values('70000000-0000-4000-8000-000000000001','Short-code QA learner','QA school','+254733000111','verified');
insert into public.learning_product_orders
(id,amount_kes,status,product_snapshot)
values('70000000-0000-4000-8000-000000000002',50,'paid','{"kind":"success_wish_text"}');
insert into public.commerce_payment_attempts
(id,order_id,provider,state,provider_result_code,provider_receipt,settled_at,callback_received_at,expected_amount_kes)
values('70000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000002',
'mpesa','settled',0,'QA-SHORT-CODE',now(),now(),50);
do $$
declare issued record; again record; saved_hash text;
begin
 if has_function_privilege('anon','public.success_wish_new_short_card_code()','EXECUTE') then
  raise exception 'Short-code generator exposed to anonymous clients'; end if;
 select * into issued from public.success_wish_issue_verified_paid_card(
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000001',
  'heritage','QA Parent','Verified test wish','2026',false);
 if not issued.newly_issued or issued.access_code !~ '^[A-Z0-9]{6}$'
  or issued.access_code !~ '[A-Z]' or issued.access_code !~ '[0-9]'
  or issued.link_secret !~ '^[a-f0-9]{64}$'
 then raise exception 'New paid issuer did not return six-character mixed card code'; end if;
 select code_hash into saved_hash from public.success_wish_card_access
  where card_id=issued.issued_card_id;
 if saved_hash <> encode(extensions.digest('success-wishes:paid-code:' || issued.access_code,'sha256'),'hex') then
  raise exception 'Short code hash does not match issued code'; end if;
 select * into again from public.success_wish_issue_verified_paid_card(
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000001',
  'heritage','QA Parent','Verified test wish','2026',false);
 if again.issued_card_id<>issued.issued_card_id or again.newly_issued
   or again.access_code is not null or again.link_secret is not null then
  raise exception 'Duplicate payment regenerated or disclosed an access credential'; end if;
end $$;
rollback;
