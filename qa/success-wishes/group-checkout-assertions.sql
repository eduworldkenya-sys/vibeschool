-- Disposable synthetic provider evidence only. Never execute in production.
begin;
insert into public.success_wish_receivers(id,display_name,school_label,phone_e164,pin_hash,pin_name_key,pin_exam_year)
values('d1111111-1111-4111-8111-111111111111','Mary','','+254733000111',repeat('a',32)||':'||repeat('b',64),'mary','2026'),
('d2222222-2222-4222-8222-222222222222','Brian','','+254733000111',repeat('a',32)||':'||repeat('b',64),'brian','2026');
do $$
declare n integer;i integer;o uuid;cards jsonb;first_card jsonb;denied boolean;links text[];gift_count integer;
begin
 if has_function_privilege('anon','public.success_wish_issue_group_gifts(uuid,text,text[])','EXECUTE')
 or has_function_privilege('authenticated','public.success_wish_issue_group_gifts(uuid,text,text[])','EXECUTE')
 or has_table_privilege('anon','public.success_wish_guest_gifts','SELECT') then raise exception 'Group access exposed';end if;
 for n in 2..4 loop
  cards:='[]'::jsonb;links:=array[]::text[];
  for i in 0..n-1 loop
   cards:=cards||jsonb_build_array(jsonb_build_object('kind','success_wish_text','candidate',case when i=0 then 'Mary' else 'Brian' end,'message','Personal message '||i,'sender','Mum','theme',case when i=0 then 'heritage' else 'nightfall' end,'examYear','2026','school','','deliveryPhone','+254733000111'));
   links:=array_append(links,md5(n::text||':'||i)||md5('link:'||n||':'||i));
  end loop;
  first_card:=cards->0;
  denied:=false;begin
   insert into public.success_wish_guest_orders(key_hash,card,group_cards,card_digest,payer_phone,amount_kes)
   values(repeat(n::text,64),first_card,cards,repeat('a',64),'254712345678',50);
  exception when check_violation then denied:=true;end;
  if not denied then raise exception 'Group underpricing accepted';end if;
  insert into public.success_wish_guest_orders(key_hash,card,group_cards,card_digest,payer_phone,amount_kes)
  values(repeat(n::text,64),first_card,cards,repeat('a',64),'254712345678',100) returning id into o;
  update public.mpesa_runtime_control set initiation_enabled=true,success_wishes_enabled=true,success_wishes_group_enabled=false;
  if public.success_wish_claim_guest_payment(o,repeat('e',64))then raise exception 'Group default-off bypass';end if;
  update public.mpesa_runtime_control set success_wishes_group_enabled=true;
  if not public.success_wish_claim_guest_payment(o,repeat('e',64)) then raise exception 'Group claim failed';end if;
  if public.success_wish_claim_guest_payment(o,repeat('e',64))then raise exception 'Duplicate payment claim';end if;
  denied:=false;begin perform public.success_wish_issue_group_gifts(o,repeat(n::text,64),links);exception when others then denied:=true;end;
  if not denied then raise exception 'Unpaid group issued';end if;
  denied:=false;begin update public.success_wish_guest_orders set group_cards='[]' where id=o;exception when others then denied:=true;end;
  if not denied then raise exception 'Snapshot mutation';end if;
  denied:=false;begin
   update public.success_wish_guest_orders set state='settled',checkout_id='QA-GROUP-'||n,merchant_id='QA-M-'||n,provider_receipt='QAGROUP'||n,provider_verified_at=now(),settled_at=now(),callback_event=jsonb_build_object('resultCode',0,'amount',50,'phone','254712345678','receipt','QAGROUP'||n,'checkout','QA-GROUP-'||n,'merchant','QA-M-'||n),provider_query=jsonb_build_object('ResponseCode','0','ResultCode','0','CheckoutRequestID','QA-GROUP-'||n,'MerchantRequestID','QA-M-'||n) where id=o;
  exception when check_violation then denied:=true;end;
  if not denied then raise exception 'KSh 50 settled group';end if;
  update public.success_wish_guest_orders set state='settled',checkout_id='QA-GROUP-'||n,merchant_id='QA-M-'||n,provider_receipt='QAGROUP'||n,provider_verified_at=now(),settled_at=now(),callback_event=jsonb_build_object('resultCode',0,'amount',100,'phone','254712345678','receipt','QAGROUP'||n,'checkout','QA-GROUP-'||n,'merchant','QA-M-'||n),provider_query=jsonb_build_object('ResponseCode','0','ResultCode','0','CheckoutRequestID','QA-GROUP-'||n,'MerchantRequestID','QA-M-'||n) where id=o;
  -- A partial RPC attempt rolls back its inserts; retry creates the complete set.
  denied:=false;begin perform public.success_wish_issue_group_gifts(o,repeat(n::text,64),(array[links[1],links[1],links[1],links[1]])[1:n]);exception when others then denied:=true;end;
  if not denied then raise exception 'Duplicate links accepted';end if;
  if exists(select 1 from public.success_wish_guest_gifts where guest_order_id=o)then raise exception 'Partial cards committed';end if;
  perform public.success_wish_issue_group_gifts(o,repeat(n::text,64),links);
  perform public.success_wish_issue_group_gifts(o,repeat(n::text,64),links);
  select count(*) into gift_count from public.success_wish_guest_gifts where guest_order_id=o;
  if gift_count<>n then raise exception 'Missing or duplicate gifts';end if;
  if public.success_wish_pin_claim('d2222222-2222-4222-8222-222222222222',links[1])then raise exception 'Sibling claimed Mary';end if;
  if not public.success_wish_pin_claim('d1111111-1111-4111-8111-111111111111',links[1])then raise exception 'Mary claim failed';end if;
  if not public.success_wish_pin_open_gift(links[1])then raise exception 'Group opening failed';end if;
  if exists(select 1 from public.success_wish_guest_gifts where guest_order_id=o and item_index>0 and (inbox_receiver_id is not null or opened_at is not null))then raise exception 'Opening affected siblings';end if;
  update public.success_wish_guest_orders set state='refunded',refunded_at=now() where id=o;
  if public.success_wish_pin_open_gift(links[1])then raise exception 'Refunded group opened';end if;
 end loop;
end $$;
rollback;
