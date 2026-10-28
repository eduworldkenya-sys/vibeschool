-- SYNTHETIC ONLY. Disposable database test; never a production payment.
begin;
insert into public.success_wish_receivers(id,display_name,school_label,phone_e164,consent_status) values('e1111111-1111-4111-8111-111111111111','QA recipient','QA school','+254712345678','verified');
insert into public.success_wish_requests(id,receiver_id,invitee_phone_e164,token_hash,expires_at) values('e2222222-2222-4222-8222-222222222222','e1111111-1111-4111-8111-111111111111','+254712345678',repeat('a',64),now()+interval '1 day');
insert into public.success_wish_guest_orders(id,key_hash,request_id,receiver_id,card,card_digest,payer_phone) values('e3333333-3333-4333-8333-333333333333',repeat('b',64),'e2222222-2222-4222-8222-222222222222','e1111111-1111-4111-8111-111111111111','{"kind":"success_wish_text","theme":"heritage","candidate":"QA recipient","school":"QA school","message":"Good luck","sender":"QA","examYear":"2026"}',repeat('c',64),'254712345678');
do $$
declare c uuid;d uuid;denied boolean;
begin
 if has_table_privilege('anon','public.mpesa_runtime_control','SELECT') or has_table_privilege('authenticated','public.mpesa_runtime_control','SELECT') then raise exception 'Payment service authentication table must remain service-only';end if;
 if has_table_privilege('anon','public.success_wish_guest_orders','SELECT') or has_table_privilege('authenticated','public.success_wish_guest_orders','UPDATE') then raise exception 'Public guest order access';end if;
 if has_function_privilege('anon','public.success_wish_claim_guest_payment(uuid,text)','EXECUTE') then raise exception 'Public payment claim';end if;
 if public.success_wish_claim_guest_payment('e3333333-3333-4333-8333-333333333333',repeat('d',64)) then raise exception 'Default-off failure';end if;
 update public.mpesa_runtime_control set initiation_enabled=true,success_wishes_enabled=true;
 if not public.success_wish_claim_guest_payment('e3333333-3333-4333-8333-333333333333',repeat('d',64)) then raise exception 'Valid claim denied';end if;
 if public.success_wish_claim_guest_payment('e3333333-3333-4333-8333-333333333333',repeat('d',64)) then raise exception 'Duplicate STK claim';end if;
 denied:=false;begin update public.success_wish_guest_orders set card='{"kind":"success_wish_text","message":"forged"}' where id='e3333333-3333-4333-8333-333333333333';exception when others then denied:=true;end;
 if not denied then raise exception 'Snapshot tamper allowed';end if;
 denied:=false;begin perform public.success_wish_issue_guest_card('e3333333-3333-4333-8333-333333333333',repeat('b',64),repeat('e',64),repeat('f',64));exception when others then denied:=true;end;
 if not denied then raise exception 'Unpaid card issued';end if;
 denied:=false;begin update public.success_wish_guest_orders set state='settled',checkout_id='QA-UNVERIFIED',merchant_id='QA-UNVERIFIED',provider_receipt='FORGED',provider_verified_at=now(),settled_at=now(),callback_event='{}' where id='e3333333-3333-4333-8333-333333333333';exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Settlement without matching query evidence allowed';end if;
 update public.success_wish_guest_orders set state='settled',checkout_id='QA-CHECKOUT',merchant_id='QA-MERCHANT',provider_receipt='QAONLY123',provider_verified_at=now(),settled_at=now(),callback_event='{"resultCode":0,"amount":50,"phone":254712345678,"receipt":"QAONLY123","checkout":"QA-CHECKOUT","merchant":"QA-MERCHANT"}',provider_query='{"ResponseCode":"0","ResultCode":"0","CheckoutRequestID":"QA-CHECKOUT","MerchantRequestID":"QA-MERCHANT"}' where id='e3333333-3333-4333-8333-333333333333';
 c:=public.success_wish_issue_guest_card('e3333333-3333-4333-8333-333333333333',repeat('b',64),repeat('e',64),repeat('f',64));
 d:=public.success_wish_issue_guest_card('e3333333-3333-4333-8333-333333333333',repeat('b',64),repeat('e',64),repeat('f',64));
 if c is null or c<>d then raise exception 'Duplicate fulfillment';end if;
 denied:=false;begin update public.success_wish_cards set message='forged' where id=c;exception when others then denied:=true;end;
 if not denied then raise exception 'Paid card tamper allowed';end if;
 update public.success_wish_guest_orders set state='refunded',refunded_at=now() where id='e3333333-3333-4333-8333-333333333333';
 denied:=false;begin perform public.success_wish_issue_guest_card('e3333333-3333-4333-8333-333333333333',repeat('b',64),repeat('e',64),repeat('f',64));exception when others then denied:=true;end;
 if not denied then raise exception 'Refunded card issued';end if;
end $$;
rollback;
