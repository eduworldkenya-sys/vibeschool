-- SYNTHETIC ONLY: sender creates and funds a card without a recipient identity or request.
begin;
insert into public.success_wish_guest_orders(id,key_hash,card,card_digest,payer_phone)
values('a3333333-3333-4333-8333-333333333333',repeat('a',64),
'{"kind":"success_wish_text","theme":"heritage","candidate":"Example candidate","school":"","message":"Keep going","sender":"Example sender","examYear":"2026"}',
repeat('b',64),'254712345678');
do $$
declare c uuid;d uuid; denied boolean;
begin
 if has_table_privilege('anon','public.success_wish_guest_gifts','SELECT')
    or has_table_privilege('authenticated','public.success_wish_guest_gifts','INSERT')
    or has_function_privilege('anon','public.success_wish_issue_unrequested_guest_gift(uuid,text,text)','EXECUTE')
 then raise exception 'Private gift leaks through public Data API';end if;
 if public.success_wish_claim_guest_payment('a3333333-3333-4333-8333-333333333333',repeat('c',64))
 then raise exception 'Default OFF allows payment';end if;
 denied:=false;
 begin
  perform public.success_wish_issue_unrequested_guest_gift('a3333333-3333-4333-8333-333333333333',repeat('a',64),repeat('d',64));
 exception when others then denied:=true;end;
 if not denied then raise exception 'Unpaid gift minted';end if;
 update public.mpesa_runtime_control set initiation_enabled=true,success_wishes_enabled=true;
 if not public.success_wish_claim_guest_payment('a3333333-3333-4333-8333-333333333333',repeat('c',64))
 then raise exception 'Sender gift was incorrectly tied to recipient';end if;
 if public.success_wish_claim_guest_payment('a3333333-3333-4333-8333-333333333333',repeat('c',64))
 then raise exception 'Duplicate payment initiated';end if;
 denied:=false;
 begin
  update public.success_wish_guest_orders
   set state='settled',checkout_id='FAKE',merchant_id='FAKE',provider_receipt='FAKE123',
   provider_verified_at=now(),settled_at=now(),callback_event='{}'
   where id='a3333333-3333-4333-8333-333333333333';
 exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Forged payment settled';end if;
 update public.success_wish_guest_orders set state='settled',checkout_id='GOODCHECKOUT',merchant_id='GOODMERCHANT',
  provider_receipt='TESTREC123',provider_verified_at=now(),settled_at=now(),
  callback_event='{"resultCode":0,"amount":50,"phone":254712345678,"receipt":"TESTREC123","checkout":"GOODCHECKOUT","merchant":"GOODMERCHANT"}',
  provider_query='{"ResponseCode":"0","ResultCode":"0","CheckoutRequestID":"GOODCHECKOUT","MerchantRequestID":"GOODMERCHANT"}'
  where id='a3333333-3333-4333-8333-333333333333';
 c:=public.success_wish_issue_unrequested_guest_gift('a3333333-3333-4333-8333-333333333333',repeat('a',64),repeat('d',64));
 d:=public.success_wish_issue_unrequested_guest_gift('a3333333-3333-4333-8333-333333333333',repeat('a',64),repeat('d',64));
 if c is null or c<>d then raise exception 'Private gift not idempotent';end if;
 denied:=false;
 begin perform public.success_wish_issue_unrequested_guest_gift('a3333333-3333-4333-8333-333333333333',repeat('a',64),repeat('e',64));
 exception when others then denied:=true;end;
 if not denied then raise exception 'Existing gift link replaced';end if;
 update public.success_wish_guest_orders set state='refunded',refunded_at=now()
  where id='a3333333-3333-4333-8333-333333333333';
 denied:=false;
 begin perform public.success_wish_issue_unrequested_guest_gift('a3333333-3333-4333-8333-333333333333',repeat('a',64),repeat('d',64));
 exception when others then denied:=true;end;
 if not denied then raise exception 'Refunded gift accepted';end if;
end $$;
rollback;