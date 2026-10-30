-- Disposable fixtures only. Preserve real cards and payment evidence; never run this fixture in production.
begin;
do $$
declare o uuid; g uuid; r uuid; r2 uuid; c jsonb; before_receivers integer; denied boolean; links text[];
begin
 c:=jsonb_build_object('kind','success_wish_text','candidate','Joe','school','Gilgil Township','examYear','2026','theme','heritage','sender','Mum','message','Good luck','deliveryPhone','+254733000111');
 insert into public.success_wish_receivers(display_name,school_label,phone_e164,pin_hash,pin_name_key,pin_exam_year,pin_epoch)
 values('Apex Plaster','Gilgil Township','+254733000111',repeat('a',32)||':'||repeat('b',64),'apex plaster','2026',1) returning id into r;
 select count(*) into before_receivers from public.success_wish_receivers;
 insert into public.success_wish_guest_orders(key_hash,card,card_digest,payer_phone,delivery_link_hashes)
 values(repeat('1',64),c,repeat('2',64),'254712345678',array[repeat('3',64)]) returning id into o;
 if exists(select 1 from public.success_wish_guest_gifts where guest_order_id=o) then raise exception 'Unpaid gift delivered';end if;
 denied:=false;begin update public.success_wish_guest_orders set state='settled' where id=o;exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Unverified payment delivered';end if;
 update public.success_wish_guest_orders set state='settled',checkout_id='AUTO-QA-C',merchant_id='AUTO-QA-M',provider_receipt='AUTOQAR',provider_verified_at=now(),settled_at=now(),callback_event='{"resultCode":0,"amount":50,"phone":254712345678,"receipt":"AUTOQAR","checkout":"AUTO-QA-C","merchant":"AUTO-QA-M"}',provider_query='{"ResponseCode":"0","ResultCode":"0","CheckoutRequestID":"AUTO-QA-C","MerchantRequestID":"AUTO-QA-M"}' where id=o;
 select id,delivery_receiver_id into g,r2 from public.success_wish_guest_gifts where guest_order_id=o;
 if g is null or r2 is null or r2=r then raise exception 'Joe merged with Apex';end if;
 if not exists(select 1 from public.success_wish_receivers where id=r and display_name='Apex Plaster' and pin_epoch=1) then raise exception 'Apex changed';end if;
 if not exists(select 1 from public.success_wish_receivers where id=r2 and display_name='Joe' and phone_e164='+254733000111' and pin_hash is null)then raise exception 'Delivery identity missing';end if;
 perform public.success_wish_issue_unrequested_guest_gift(o,repeat('1',64),repeat('3',64));
 update public.success_wish_guest_orders set state='settled' where id=o;
 if (select count(*) from public.success_wish_guest_gifts where guest_order_id=o)<>1 or (select count(*) from public.success_wish_receivers)<>before_receivers+1 then raise exception 'Retry duplicated card/recipient';end if;
 -- Browser sessions carry specific gifts only; no collection receiver and no PIN epoch.
 insert into public.success_wish_receiver_sessions(token_hash,guest_browser_hash,guest_gift_id,expires_at) values(repeat('4',64),repeat('5',64),g,now()+interval '1 day');
 denied:=false;begin insert into public.success_wish_receiver_sessions(receiver_id,token_hash,guest_browser_hash,guest_gift_id,expires_at)values(r,repeat('6',64),repeat('5',64),g,now()+interval '1 day');exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Gift capability became collection capability';end if;
 if has_function_privilege('anon','public.success_wish_delivery_recipient()','EXECUTE') or has_table_privilege('authenticated','public.success_wish_receiver_sessions','SELECT')then raise exception 'Private delivery exposed';end if;
 -- Same name and same address still receive independent intended-recipient IDs.
 insert into public.success_wish_free_gifts(key_hash,link_hash,card,card_digest,expires_at)values(repeat('7',64),repeat('8',64),c,repeat('9',64),now()+interval '1 day');
 if (select delivery_receiver_id from public.success_wish_free_gifts where key_hash=repeat('7',64))=r2 then raise exception 'Name/address inferred identity';end if;
 -- Automatic group delivery creates each sibling independently in one transaction.
 links:=array[repeat('a',64),repeat('b',64)];
 insert into public.success_wish_guest_orders(key_hash,card,group_cards,card_digest,payer_phone,amount_kes,delivery_link_hashes)
 values(repeat('c',64),c,jsonb_build_array(c,c),repeat('d',64),'254712345678',100,links) returning id into o;
 update public.success_wish_guest_orders set state='settled',checkout_id='AUTO-QA-GC',merchant_id='AUTO-QA-GM',provider_receipt='AUTOQAGR',provider_verified_at=now(),settled_at=now(),callback_event='{"resultCode":0,"amount":100,"phone":254712345678,"receipt":"AUTOQAGR","checkout":"AUTO-QA-GC","merchant":"AUTO-QA-GM"}',provider_query='{"ResponseCode":"0","ResultCode":"0","CheckoutRequestID":"AUTO-QA-GC","MerchantRequestID":"AUTO-QA-GM"}' where id=o;
 if (select count(distinct delivery_receiver_id) from public.success_wish_guest_gifts where guest_order_id=o)<>2 then raise exception 'Group recipients merged';end if;
 perform public.success_wish_issue_group_gifts(o,repeat('c',64),links);
 if (select count(*) from public.success_wish_guest_gifts where guest_order_id=o)<>2 then raise exception 'Group replay duplicated';end if;
 -- An explicit authorised receiver request assigns directly to the existing collection.
 c:=jsonb_set(c,'{candidate}','"Apex Plaster"');
 insert into public.success_wish_guest_orders(key_hash,card,card_digest,payer_phone,inbox_receiver_id,delivery_link_hashes)
 values(repeat('e',64),c,repeat('f',64),'254712345678',r,array[repeat('0',64)]) returning id into o;
 update public.success_wish_guest_orders set state='settled',checkout_id='AUTO-QA-EC',merchant_id='AUTO-QA-EM',provider_receipt='AUTOQAER',provider_verified_at=now(),settled_at=now(),callback_event='{"resultCode":0,"amount":50,"phone":254712345678,"receipt":"AUTOQAER","checkout":"AUTO-QA-EC","merchant":"AUTO-QA-EM"}',provider_query='{"ResponseCode":"0","ResultCode":"0","CheckoutRequestID":"AUTO-QA-EC","MerchantRequestID":"AUTO-QA-EM"}' where id=o;
 if not exists(select 1 from public.success_wish_guest_orders where id=o and inbox_receiver_id=r) or not exists(select 1 from public.success_wish_guest_gifts where guest_order_id=o and delivery_receiver_id=r) then raise exception 'Explicit recipient delivery lost';end if;
 -- Free retries must not leave orphan recipient records behind ON CONFLICT.
 update public.success_wishes_pilot_control set free_text_enabled=true;
 select count(*) into before_receivers from public.success_wish_receivers;
 perform public.success_wish_issue_free_guest_gift(repeat('a',32)||repeat('b',32),repeat('b',32)||repeat('a',32),c,repeat('c',32)||repeat('d',32));
 perform public.success_wish_issue_free_guest_gift(repeat('a',32)||repeat('b',32),repeat('b',32)||repeat('a',32),c,repeat('c',32)||repeat('d',32));
 if (select count(*) from public.success_wish_receivers)<>before_receivers+1 then raise exception 'Free retry orphaned recipients';end if;
end $$;
rollback;
