-- Guest checkout is service-only and default OFF. Existing registered payments are preserved.
-- access: service-only public.success_wish_guest_orders
-- authorization-test: public.success_wish_guest_orders
create table public.success_wish_guest_orders(
 id uuid primary key default gen_random_uuid(),
 key_hash text not null unique check(key_hash ~ '^[a-f0-9]{64}$'),
 request_id uuid not null references public.success_wish_requests(id),
 receiver_id uuid not null references public.success_wish_receivers(id),
 card jsonb not null check(card->>'kind'='success_wish_text'),
 card_digest text not null check(card_digest ~ '^[a-f0-9]{64}$'),
 payer_phone text not null check(payer_phone ~ '^254[17][0-9]{8}$'),
 amount_kes integer not null default 50 check(amount_kes=50),
 state text not null default 'created' check(state in ('created','submitting','awaiting_customer','reconciliation_required','settled','failed','refunded')),
 checkout_id text unique,merchant_id text,callback_hash text,provider_receipt text unique,
 callback_event jsonb,provider_query jsonb,provider_verified_at timestamptz,settled_at timestamptz,refunded_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(state<>'settled' or (checkout_id is not null and merchant_id is not null and provider_receipt is not null
  and provider_verified_at is not null and settled_at is not null and refunded_at is null
  and coalesce(callback_event->>'resultCode'='0' and callback_event->>'amount'='50'
   and callback_event->>'phone'=payer_phone and callback_event->>'receipt'=provider_receipt
   and callback_event->>'checkout'=checkout_id and callback_event->>'merchant'=merchant_id
   and provider_query->>'ResultCode'='0' and provider_query->>'ResponseCode'='0'
   and provider_query->>'CheckoutRequestID'=checkout_id and provider_query->>'MerchantRequestID'=merchant_id,false)))
);
alter table public.success_wish_guest_orders enable row level security;
revoke all on public.success_wish_guest_orders from public,anon,authenticated;
grant select,insert,update on public.success_wish_guest_orders to service_role;
alter table public.mpesa_runtime_control add column if not exists success_wishes_enabled boolean not null default false;
create function public.success_wish_guest_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if row(new.key_hash,new.request_id,new.receiver_id,new.card,new.card_digest,new.payer_phone,new.amount_kes)
 is distinct from row(old.key_hash,old.request_id,old.receiver_id,old.card,old.card_digest,old.payer_phone,old.amount_kes)
 then raise exception 'A saved guest order cannot be edited';end if;
 if old.state in ('settled','refunded') and new.state not in ('settled','refunded') then raise exception 'Cannot reverse settlement';end if;
 return new;
end $$;
revoke all on function public.success_wish_guest_immutable() from public,anon,authenticated;
create trigger success_wish_guest_immutable before update on public.success_wish_guest_orders for each row execute function public.success_wish_guest_immutable();
create function public.success_wish_claim_guest_payment(p_id uuid,p_callback_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.mpesa_runtime_control where singleton and initiation_enabled and success_wishes_enabled) then return false;end if;
 update public.success_wish_guest_orders o set state='submitting',callback_hash=p_callback_hash,updated_at=now()
 where o.id=p_id and o.state='created' and o.created_at>now()-interval '24 hours'
 and exists(select 1 from public.success_wish_receivers r where r.id=o.receiver_id and r.consent_status='verified')
 and exists(select 1 from public.success_wish_requests r where r.id=o.request_id and r.receiver_id=o.receiver_id and r.cancelled_at is null and r.expires_at>now());
 return found;
end $$;
revoke all on function public.success_wish_claim_guest_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.success_wish_claim_guest_payment(uuid,text) to service_role;
alter table public.success_wish_cards alter column payment_attempt_id drop not null;
alter table public.success_wish_cards add column guest_order_id uuid unique references public.success_wish_guest_orders(id);
alter table public.success_wish_cards add constraint success_wish_one_settlement check(num_nonnulls(payment_attempt_id,guest_order_id)=1);
create or replace function public.success_wish_assert_real_settlement() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.guest_order_id is not null then
  if not exists(select 1 from public.success_wish_guest_orders o where o.id=new.guest_order_id and o.state='settled'
   and o.amount_kes=50 and o.provider_verified_at is not null and o.provider_receipt is not null and o.settled_at is not null
   and o.refunded_at is null and o.receiver_id=new.receiver_id and o.card->>'theme'=new.theme
   and o.card->>'message'=new.message and o.card->>'sender'=new.sender_name and o.card->>'examYear'=new.exam_year)
  then raise exception 'Verified guest settlement required' using errcode='23514';end if;
 else
  if not exists(select 1 from public.commerce_payment_attempts a join public.learning_product_orders o on o.id=a.order_id
   where a.id=new.payment_attempt_id and a.provider='mpesa' and a.state='settled' and a.provider_result_code=0
   and a.provider_receipt is not null and a.settled_at is not null and a.callback_received_at is not null
   and a.expected_amount_kes=50 and o.amount_kes=50 and o.status='paid' and o.refunded_at is null
   and o.product_snapshot->>'kind'='success_wish_text')
  then raise exception 'Verified commerce settlement required' using errcode='23514';end if;
 end if;
 return new;
end $$;
drop trigger success_wish_paid_insert on public.success_wish_cards;
create trigger success_wish_paid_insert before insert or update of payment_attempt_id,guest_order_id,receiver_id,theme,sender_name,message,exam_year on public.success_wish_cards for each row execute function public.success_wish_assert_real_settlement();
revoke all on function public.success_wish_assert_real_settlement() from public,anon,authenticated;
create function public.success_wish_issue_guest_card(p_id uuid,p_key_hash text,p_link_hash text,p_code_hash text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare o public.success_wish_guest_orders;c uuid;
begin
 select * into o from public.success_wish_guest_orders where id=p_id and key_hash=p_key_hash for update;
 if o.id is null or o.state<>'settled' or o.refunded_at is not null then raise exception 'Settled guest order required';end if;
 if not exists(select 1 from public.success_wish_receivers where id=o.receiver_id and consent_status='verified') then raise exception 'Recipient consent unavailable';end if;
 select id into c from public.success_wish_cards where guest_order_id=o.id;
 if c is not null then return c;end if;
 insert into public.success_wish_cards(receiver_id,guest_order_id,theme,sender_name,message,exam_year,expires_at)
 values(o.receiver_id,o.id,o.card->>'theme',o.card->>'sender',o.card->>'message',o.card->>'examYear',o.settled_at+interval '90 days') returning id into c;
 insert into public.success_wish_card_access(card_id,link_hash,code_hash,expires_at) values(c,p_link_hash,p_code_hash,o.settled_at+interval '90 days');
 return c;
end $$;
revoke all on function public.success_wish_issue_guest_card(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.success_wish_issue_guest_card(uuid,text,text,text) to service_role;
