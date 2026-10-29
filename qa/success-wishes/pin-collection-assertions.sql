-- Disposable fixture only; every synthetic record is rolled back.
begin;
insert into public.success_wish_receivers(id,display_name,school_label,phone_e164,pin_hash,pin_name_key,pin_epoch,pin_exam_year,pin_recovery_hash)
values('e1111111-1111-4111-8111-111111111111','Example learner','','+254733000111',repeat('a',32)||':'||repeat('b',64),'example learner',1,'2026',repeat('c',64)),
('e2222222-2222-4222-8222-222222222222','Sibling','','+254733000111',repeat('a',32)||':'||repeat('b',64),'sibling',1,'2026',repeat('d',64));
insert into public.success_wish_free_gifts(id,key_hash,link_hash,card,card_digest,expires_at)
values('e3333333-3333-4333-8333-333333333333',repeat('e',64),repeat('f',64),'{"kind":"success_wish_text","candidate":"Example learner","examYear":"2026","sender":"Mum","message":"Keep going","theme":"heritage","school":""}',repeat('a',64),now()+interval '90 days');
insert into public.success_wish_receiver_sessions(receiver_id,token_hash,pin_epoch,expires_at)values('e1111111-1111-4111-8111-111111111111',repeat('1',64),1,now()+interval '90 days');
do $$ declare r record;denied boolean;begin
 if has_function_privilege('anon','public.success_wish_pin_claim(uuid,text)','EXECUTE') or has_function_privilege('authenticated','public.success_wish_pin_recover(text,text,text,text,text)','EXECUTE') or has_table_privilege('anon','public.success_wish_receivers','SELECT')then raise exception 'PIN capabilities exposed';end if;
 if public.success_wish_pin_claim('e2222222-2222-4222-8222-222222222222',repeat('f',64))then raise exception 'Sibling claimed wrong gift';end if;
 if not public.success_wish_pin_claim('e1111111-1111-4111-8111-111111111111',repeat('f',64))then raise exception 'Authorised claim failed';end if;
 if not public.success_wish_pin_claim('e1111111-1111-4111-8111-111111111111',repeat('f',64))then raise exception 'Claim retry failed';end if;
 denied:=false;begin update public.success_wish_free_gifts set inbox_receiver_id='e2222222-2222-4222-8222-222222222222' where id='e3333333-3333-4333-8333-333333333333';exception when others then denied:=true;end;if not denied then raise exception 'Claim moved';end if;
 select * into r from public.success_wish_pin_recover(repeat('c',64),repeat('2',64),repeat('a',32)||':'||repeat('b',64),repeat('4',64),repeat('5',64));
 if r.id is null or r.pin_epoch<>2 then raise exception 'Recovery did not rotate epoch';end if;
 if exists(select 1 from public.success_wish_receiver_sessions where token_hash=repeat('1',64))then raise exception 'Old session survived';end if;
 if not exists(select 1 from public.success_wish_receiver_sessions where token_hash=repeat('5',64) and pin_epoch=2)then raise exception 'Recovery session missing';end if;
 if not exists(select 1 from public.success_wish_pin_recover(repeat('c',64),repeat('2',64),repeat('a',32)||':'||repeat('b',64),repeat('4',64),repeat('5',64)))then raise exception 'Lost-response retry failed';end if;
 if exists(select 1 from public.success_wish_pin_recover(repeat('c',64),repeat('3',64),repeat('a',32)||':'||repeat('b',64),repeat('6',64),repeat('7',64)))then raise exception 'Recovery replay accepted';end if;
 update public.success_wish_receivers set pin_previous_recovery_hash=null,pin_reset_hash=null where id='e1111111-1111-4111-8111-111111111111';
 if exists(select 1 from public.success_wish_pin_recover(repeat('c',64),repeat('2',64),repeat('a',32)||':'||repeat('b',64),repeat('4',64),repeat('5',64)))then raise exception 'Confirmed recovery retry accepted';end if;
 update public.success_wish_receivers set consent_status='revoked' where id='e1111111-1111-4111-8111-111111111111';if public.success_wish_pin_claim('e1111111-1111-4111-8111-111111111111',repeat('f',64))then raise exception 'Revoked receiver claimed';end if;
end $$;
rollback;
-- Paid address correction invalidates the old bearer link and is closed after opening.
begin;
insert into public.success_wish_guest_orders(id,key_hash,card,card_digest,payer_phone)
values('e4444444-4444-4444-8444-444444444444',repeat('8',64),'{"kind":"success_wish_text","candidate":"Example learner","examYear":"2026","sender":"Mum","message":"Keep going","theme":"heritage","school":"","deliveryPhone":"+254733000111"}',repeat('9',64),'254712345678');
update public.success_wish_guest_orders set state='settled',checkout_id='PINQACHECKOUT',merchant_id='PINQAMERCHANT',provider_receipt='PINQARECEIPT',provider_verified_at=now(),settled_at=now(),callback_event='{"resultCode":0,"amount":50,"phone":254712345678,"receipt":"PINQARECEIPT","checkout":"PINQACHECKOUT","merchant":"PINQAMERCHANT"}',provider_query='{"ResponseCode":"0","ResultCode":"0","CheckoutRequestID":"PINQACHECKOUT","MerchantRequestID":"PINQAMERCHANT"}' where id='e4444444-4444-4444-8444-444444444444';
insert into public.success_wish_guest_gifts(guest_order_id,link_hash,expires_at)values('e4444444-4444-4444-8444-444444444444',repeat('a',64),now()+interval '90 days');
do $$ begin
 if not public.success_wish_pin_correct_address(repeat('8',64),'+254733000222',0,repeat('b',64))then raise exception 'Unclaimed address correction failed';end if;
 if public.success_wish_pin_open_gift(repeat('a',64))then raise exception 'Old corrected link still works';end if;
 if not public.success_wish_pin_correct_address(repeat('8',64),'+254733000222',0,repeat('b',64))then raise exception 'Correction retry failed';end if;
 if not public.success_wish_pin_open_gift(repeat('b',64))then raise exception 'Corrected gift failed to open';end if;
 if public.success_wish_pin_correct_address(repeat('8',64),'+254733000333',1,repeat('c',64))then raise exception 'Opened gift correction allowed';end if;
end $$;
rollback;
