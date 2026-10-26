-- Disposable receiver first-access and guardian-consent SQL contract.
-- Uses synthetic commerce rows; not evidence of a live M-Pesa or SMS transaction.
insert into public.success_wish_receivers
 (id,display_name,school_label,phone_e164,consent_status,consent_route,guardian_phone_e164)
values
 ('50000000-0000-4000-8000-000000000003','Pending Candidate','School Gamma',
  '+254712000111','pending','guardian','+254733222111');
insert into public.learning_product_orders (id,amount_kes,status,product_snapshot)
values ('30000000-0000-4000-8000-000000000005',50,'paid','{"kind":"success_wish_text"}');
insert into public.commerce_payment_attempts
 (id,order_id,provider,state,provider_result_code,provider_receipt,settled_at,callback_received_at,expected_amount_kes)
values ('40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000005',
  'mpesa','settled',0,'TEST-PENDING-ONLY',now(),now(),50);
do $$
declare gift record;
declare challenge_id uuid := '70000000-0000-4000-8000-000000000005';
declare digest_value text := repeat('a',64);
begin
  select * into gift from public.success_wish_issue_verified_paid_card(
    '40000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000003',
    'nightfall','Guardian','This sealed message is not visible until verified.','2026',false);
  if not gift.newly_issued or gift.issued_card_id is null then
    raise exception 'Pending consent recipient must be able to receive a sealed paid envelope'; end if;
  if (select consent_status from public.success_wish_receivers
      where id='50000000-0000-4000-8000-000000000003') <> 'pending' then
    raise exception 'Issuing a gift must never imply consent'; end if;

  insert into public.success_wish_receiver_challenges(id,receiver_id,code_hash,purpose,expires_at)
    values (challenge_id,'50000000-0000-4000-8000-000000000003',digest_value,
      'consent_guardian',now()+interval '5 minutes');
  if public.success_wish_consume_receiver_challenge(
    challenge_id,'50000000-0000-4000-8000-000000000003',digest_value,'recovery'
  ) then raise exception 'Guardian approval accepted as recovery'; end if;
  if not public.success_wish_consume_receiver_challenge(
    challenge_id,'50000000-0000-4000-8000-000000000003',digest_value,'consent_guardian'
  ) then raise exception 'Registered guardian challenge could not be consumed'; end if;
  if public.success_wish_consume_receiver_challenge(
    challenge_id,'50000000-0000-4000-8000-000000000003',digest_value,'consent_guardian'
  ) then raise exception 'Consumed challenge was reused'; end if;
  if has_function_privilege('anon',
      'public.success_wish_consume_receiver_challenge(uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.success_wish_consume_receiver_challenge(uuid,uuid,text,text)','EXECUTE')
  then raise exception 'OTP approval leaked to public clients'; end if;
end $$;
