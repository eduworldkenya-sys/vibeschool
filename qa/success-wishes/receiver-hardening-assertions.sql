-- Synthetic-only SQL. No provider, production student or real payment is exercised.
do $$
declare rid uuid:='90000000-0000-4000-8000-000000000001';
 gid uuid:='90000000-0000-4000-8000-000000000002';
 wid uuid:='90000000-0000-4000-8000-000000000003';
 school1 uuid:='11111111-1111-4111-8111-111111111111';
 admin1 uuid:='33333333-3333-4333-8333-333333333333';
 request_id uuid:='90000000-0000-4000-8000-000000000007';
begin
 insert into public.success_wish_receivers(id,display_name,phone_e164,guardian_phone_e164,consent_route)
 values(rid,'Synthetic learner','+254712000222','+254712000222','guardian');
 insert into public.success_wish_receiver_challenges(id,receiver_id,code_hash,expires_at,purpose)
 values(gid,rid,repeat('a',64),now()+interval '5 minutes','consent_guardian');
 if public.success_wish_record_receiver_consent(rid,gid,repeat('a',64),'withdraw','guardian','receiver-2026-10-26-v1') then raise exception 'Grant OTP accepted as withdrawal'; end if;
 if public.success_wish_record_receiver_consent(rid,gid,repeat('b',64),'grant','guardian','receiver-2026-10-26-v1') then raise exception 'Wrong OTP accepted'; end if;
 if not public.success_wish_record_receiver_consent(rid,gid,repeat('a',64),'grant','guardian','receiver-2026-10-26-v1') then raise exception 'Valid grant failed'; end if;
 if public.success_wish_record_receiver_consent(rid,gid,repeat('a',64),'grant','guardian','receiver-2026-10-26-v1') then raise exception 'Replay accepted'; end if;
 insert into public.learning_product_orders(id,amount_kes,status,product_snapshot) values('90000000-0000-4000-8000-000000000004',50,'paid','{"kind":"success_wish_text"}');
 insert into public.commerce_payment_attempts(id,order_id,provider,state,provider_result_code,provider_receipt,settled_at,callback_received_at,expected_amount_kes) values('90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000004','mpesa','settled',0,'SYNTHETIC-NO-PAYMENT',now(),now(),50);
 insert into public.success_wish_cards(id,receiver_id,payment_attempt_id,theme,sender_name,message,exam_year,expires_at) values('90000000-0000-4000-8000-000000000006',rid,'90000000-0000-4000-8000-000000000005','heritage','Synthetic guardian','Synthetic wish','2026',now()+interval '1 day');
 insert into public.success_wish_card_sessions(token_hash,card_id,expires_at) values(repeat('8',64),'90000000-0000-4000-8000-000000000006',now()+interval '1 day');
 insert into public.success_wish_receiver_sessions(token_hash,receiver_id,expires_at) values(repeat('9',64),rid,now()+interval '1 day');
 insert into public.success_wish_receiver_challenges(id,receiver_id,code_hash,expires_at,purpose) values(wid,rid,repeat('c',64),now()-interval '1 second','withdraw_guardian');
 if public.success_wish_record_receiver_consent(rid,wid,repeat('c',64),'withdraw','guardian','receiver-2026-10-26-v1') then raise exception 'Expired OTP accepted'; end if;
 update public.success_wish_receiver_challenges set expires_at=now()+interval '5 minutes' where id=wid;
 if not public.success_wish_record_receiver_consent(rid,wid,repeat('c',64),'withdraw','guardian','receiver-2026-10-26-v1') then raise exception 'Withdrawal failed'; end if;
 if (select consent_status from public.success_wish_receivers where id=rid)<>'revoked'
 or exists(select 1 from public.success_wish_receiver_sessions where receiver_id=rid)
 or exists(select 1 from public.success_wish_card_sessions where card_id='90000000-0000-4000-8000-000000000006') then raise exception 'Sessions survived withdrawal'; end if;
 if (select count(*) from public.success_wish_consent_events where receiver_id=rid)<>2 then raise exception 'Audit events missing'; end if;
 insert into public.success_wish_receiver_provisioning_audit(receiver_id,student_id,school_id,guardian_link_id,school_admin_id,school_record_reference_digest)
 values(rid,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',school1,'70000000-0000-4000-8000-000000000001',admin1,repeat('f',64));
 insert into public.success_wish_data_requests(id,receiver_id,kind)values(request_id,rid,'deletion');
 if public.success_wish_review_privacy_case('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',request_id,'request','reviewing','SYNTHETIC-CASE-REFERENCE') then raise exception 'Cross-school review allowed'; end if;
 if public.success_wish_review_privacy_case(school1,admin1,request_id,'request','completed','SYNTHETIC-CASE-REFERENCE') then raise exception 'Skipped review allowed'; end if;
 if not public.success_wish_review_privacy_case(school1,admin1,request_id,'request','reviewing','SYNTHETIC-CASE-REFERENCE') then raise exception 'Review failed'; end if;
 if not public.success_wish_review_privacy_case(school1,admin1,request_id,'request','completed','SYNTHETIC-CASE-REFERENCE') then raise exception 'Completion failed'; end if;
 if (select count(*) from public.success_wish_privacy_actions where target_id=request_id)<>2 then raise exception 'Privacy review audit missing'; end if;
 if has_table_privilege('anon','public.success_wish_consent_events','select')
 or has_table_privilege('service_role','public.success_wish_consent_events','update')
 or has_table_privilege('service_role','public.success_wish_privacy_actions','delete')
 or has_function_privilege('anon','public.success_wish_record_receiver_consent(uuid,uuid,text,text,text,text)','execute')
 or has_function_privilege('authenticated','public.success_wish_review_privacy_case(uuid,uuid,uuid,text,text,text)','execute') then raise exception 'Unsafe public/audit grants'; end if;
end $$;
