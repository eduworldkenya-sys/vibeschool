alter table public.mpesa_runtime_control add column success_wishes_group_enabled boolean not null default false;
-- Group commissioning is separate from the already operating single-card checkout.
-- Group purchases extend the existing order, provider and private-gift ledgers.
-- access: service-only public.success_wish_guest_orders
-- authorization-test: public.success_wish_guest_orders
-- access: service-only public.success_wish_guest_gifts
-- authorization-test: public.success_wish_guest_gifts
alter table public.success_wish_guest_orders add column group_cards jsonb;
alter table public.success_wish_guest_orders drop constraint success_wish_guest_orders_amount_kes_check;
alter table public.success_wish_guest_orders add constraint success_wish_guest_price check(
 (group_cards is null and amount_kes=50) or
 (group_cards is not null and jsonb_typeof(group_cards)='array' and jsonb_array_length(group_cards) between 2 and 4
  and amount_kes=100 and receiver_id is null and request_id is null and inbox_receiver_id is null and card=group_cards->0));
alter table public.success_wish_guest_orders drop constraint success_wish_guest_orders_check;
alter table public.success_wish_guest_orders add constraint success_wish_guest_verified_settlement check(
 state<>'settled' or (checkout_id is not null and merchant_id is not null and provider_receipt is not null
 and provider_verified_at is not null and settled_at is not null and refunded_at is null
 and coalesce(callback_event->>'resultCode'='0' and (callback_event->>'amount')::numeric=amount_kes
 and callback_event->>'phone'=payer_phone and callback_event->>'receipt'=provider_receipt
 and callback_event->>'checkout'=checkout_id and callback_event->>'merchant'=merchant_id
 and provider_query->>'ResultCode'='0' and provider_query->>'ResponseCode'='0'
 and provider_query->>'CheckoutRequestID'=checkout_id and provider_query->>'MerchantRequestID'=merchant_id,false)));
create or replace function public.success_wish_guest_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if row(new.key_hash,new.request_id,new.receiver_id,new.card,new.group_cards,new.card_digest,new.payer_phone,new.amount_kes)
 is distinct from row(old.key_hash,old.request_id,old.receiver_id,old.card,old.group_cards,old.card_digest,old.payer_phone,old.amount_kes)
 then raise exception 'A saved guest order cannot be edited';end if;
 if old.state in ('settled','refunded') and new.state not in ('settled','refunded') then raise exception 'Cannot reverse settlement';end if;
 return new;
end $$;
alter table public.success_wish_guest_gifts drop constraint success_wish_guest_gifts_guest_order_id_key;
alter table public.success_wish_guest_gifts add column item_index integer check(item_index between 0 and 3),
 add column card jsonb, add column inbox_receiver_id uuid references public.success_wish_receivers(id),
 add column inbox_claimed_at timestamptz,add column inbox_opened_at timestamptz;
create unique index success_wish_single_gift_unique on public.success_wish_guest_gifts(guest_order_id) where item_index is null;
create unique index success_wish_group_gift_unique on public.success_wish_guest_gifts(guest_order_id,item_index) where item_index is not null;
create index success_wish_group_inbox on public.success_wish_guest_gifts(inbox_receiver_id) where inbox_receiver_id is not null;
create function public.success_wish_group_gift_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare o public.success_wish_guest_orders;
begin
 if tg_op='UPDATE' then
  if row(new.guest_order_id,new.item_index,new.card) is distinct from row(old.guest_order_id,old.item_index,old.card)
   then raise exception 'Gift snapshot cannot change';end if;
  if old.inbox_receiver_id is not null and new.inbox_receiver_id is distinct from old.inbox_receiver_id then raise exception 'Claimed gift cannot move';end if;
 end if;
 select * into o from public.success_wish_guest_orders where id=new.guest_order_id;
 if new.item_index is null then
  if new.card is not null or o.group_cards is not null then raise exception 'Invalid single gift';end if;
 else
  if o.state<>'settled' or o.amount_kes<>100 or o.refunded_at is not null or o.provider_verified_at is null
   or o.group_cards is null or new.card is distinct from o.group_cards->new.item_index then raise exception 'Verified group item required';end if;
 end if;
 return new;
end $$;
revoke all on function public.success_wish_group_gift_guard() from public,anon,authenticated;
create trigger success_wish_group_gift_guard before insert or update on public.success_wish_guest_gifts for each row execute function public.success_wish_group_gift_guard();
create function public.success_wish_issue_group_gifts(p_id uuid,p_key_hash text,p_links text[]) returns boolean
language plpgsql security invoker set search_path='' as $$
declare o public.success_wish_guest_orders; i integer; g public.success_wish_guest_gifts;
begin
 select * into o from public.success_wish_guest_orders where id=p_id and key_hash=p_key_hash for update;
 if o.id is null or o.state<>'settled' or o.amount_kes<>100 or o.refunded_at is not null
 or o.provider_verified_at is null or o.provider_receipt is null or o.settled_at is null
 or o.group_cards is null or cardinality(p_links)<>jsonb_array_length(o.group_cards)
 then raise exception 'Verified settled group required';end if;
 for i in 0..jsonb_array_length(o.group_cards)-1 loop
  if coalesce(p_links[i+1],'') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid private link';end if;
  select * into g from public.success_wish_guest_gifts where guest_order_id=o.id and item_index=i;
  if g.id is not null then
   if g.link_hash<>p_links[i+1] then raise exception 'Gift key mismatch';end if;
  else
   insert into public.success_wish_guest_gifts(guest_order_id,item_index,card,link_hash,expires_at)
   values(o.id,i,o.group_cards->i,p_links[i+1],o.settled_at+interval '90 days');
  end if;
 end loop;
 return true;
end $$;
revoke all on function public.success_wish_issue_group_gifts(uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.success_wish_issue_group_gifts(uuid,text,text[]) to service_role;

create or replace function public.success_wish_pin_claim(p_receiver uuid,p_link_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.success_wish_receivers;g public.success_wish_guest_gifts;o public.success_wish_guest_orders;f public.success_wish_free_gifts;
begin
 select * into r from public.success_wish_receivers where id=p_receiver and pin_hash is not null and consent_status<>'revoked';
 if r.id is null or coalesce(p_link_hash,'') !~ '^[a-f0-9]{64}$' then return false;end if;
 select * into g from public.success_wish_guest_gifts where link_hash=p_link_hash and revoked_at is null and expires_at>now();
 if g.id is not null then
  select * into o from public.success_wish_guest_orders where id=g.guest_order_id for update;
  if g.item_index is not null then
   if o.state<>'settled' or o.amount_kes<>100 or o.refunded_at is not null or o.provider_verified_at is null or o.provider_receipt is null or o.settled_at is null then return false;end if;
   select * into g from public.success_wish_guest_gifts where id=g.id for update;
   if g.revoked_at is not null or g.expires_at<=now() or g.card is distinct from o.group_cards->g.item_index then return false;end if;
   if lower(regexp_replace(btrim(g.card->>'candidate'),'\s+',' ','g'))<>r.pin_name_key or g.card->>'examYear'<>r.pin_exam_year or g.inbox_receiver_id is not null and g.inbox_receiver_id<>r.id then return false;end if;
   update public.success_wish_guest_gifts set inbox_receiver_id=r.id,inbox_claimed_at=coalesce(inbox_claimed_at,now()),inbox_opened_at=coalesce(inbox_opened_at,opened_at) where id=g.id;
   return true;
  end if;
  if o.state<>'settled' or o.refunded_at is not null or o.amount_kes<>50 or o.provider_receipt is null or o.provider_verified_at is null or o.settled_at is null or o.settled_at+interval '90 days'<=now() then return false;end if;
  if not exists(select 1 from public.success_wish_guest_gifts where id=g.id and link_hash=p_link_hash and revoked_at is null and expires_at>now())then return false;end if;
  if lower(regexp_replace(btrim(o.card->>'candidate'),'\s+',' ','g'))<>r.pin_name_key or o.card->>'examYear'<>r.pin_exam_year or o.inbox_receiver_id is not null and o.inbox_receiver_id<>r.id then return false;end if;
  update public.success_wish_guest_orders set inbox_receiver_id=r.id,inbox_claimed_at=coalesce(inbox_claimed_at,now()),inbox_opened_at=coalesce(inbox_opened_at,g.opened_at) where id=o.id;
  return true;
 end if;
 select * into f from public.success_wish_free_gifts where link_hash=p_link_hash and revoked_at is null and expires_at>now() for update;
 if f.id is null or lower(regexp_replace(btrim(f.card->>'candidate'),'\s+',' ','g'))<>r.pin_name_key or f.card->>'examYear'<>r.pin_exam_year or f.inbox_receiver_id is not null and f.inbox_receiver_id<>r.id then return false;end if;
 update public.success_wish_free_gifts set inbox_receiver_id=r.id,inbox_claimed_at=coalesce(inbox_claimed_at,now()),inbox_opened_at=coalesce(inbox_opened_at,opened_at) where id=f.id;
 return true;
end $$;
revoke all on function public.success_wish_pin_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.success_wish_pin_claim(uuid,text) to service_role;

create or replace function public.success_wish_pin_open_gift(p_link text) returns boolean language plpgsql security invoker set search_path='' as $$
declare g public.success_wish_guest_gifts;o public.success_wish_guest_orders;
begin
 select * into g from public.success_wish_guest_gifts where link_hash=p_link and revoked_at is null and expires_at>now();
 if g.id is null then return false;end if;
 select * into o from public.success_wish_guest_orders where id=g.guest_order_id for update;
 if g.item_index is not null then
  if o.state<>'settled' or o.amount_kes<>100 or o.refunded_at is not null or o.provider_verified_at is null or o.provider_receipt is null or o.settled_at is null or g.card is distinct from o.group_cards->g.item_index then return false;end if;
  update public.success_wish_guest_gifts set opened_at=coalesce(opened_at,now()),inbox_opened_at=coalesce(inbox_opened_at,now()) where id=g.id and link_hash=p_link and revoked_at is null and expires_at>now();
  return found;
 end if;
 if o.state<>'settled' or o.amount_kes<>50 or o.refunded_at is not null or o.provider_receipt is null or o.provider_verified_at is null or o.settled_at is null then return false;end if;
 update public.success_wish_guest_gifts set opened_at=coalesce(opened_at,now()) where id=g.id and link_hash=p_link and revoked_at is null and expires_at>now();
 if not found then return false;end if;
 update public.success_wish_guest_orders set inbox_opened_at=coalesce(inbox_opened_at,now()),inbox_claimed_at=coalesce(inbox_claimed_at,now()) where id=o.id;
 return true;
end $$;
revoke all on function public.success_wish_pin_open_gift(text) from public,anon,authenticated;
grant execute on function public.success_wish_pin_open_gift(text) to service_role;

create or replace function public.success_wish_claim_guest_payment(p_id uuid,p_callback_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(p_callback_hash,'') !~ '^[a-f0-9]{64}$' then return false; end if;
 if not exists(select 1 from public.mpesa_runtime_control
   where singleton and initiation_enabled and success_wishes_enabled) then return false; end if;
 update public.success_wish_guest_orders o
 set state='submitting',callback_hash=p_callback_hash,updated_at=now()
 where o.id=p_id and o.state='created' and o.created_at>now()-interval '24 hours'
 and (o.group_cards is null or exists(select 1 from public.mpesa_runtime_control where singleton and success_wishes_group_enabled))
 and (
   (o.receiver_id is null and o.request_id is null)
   or (o.receiver_id is not null and o.request_id is not null
     and exists(select 1 from public.success_wish_receivers r
       where r.id=o.receiver_id and r.consent_status='verified')
     and exists(select 1 from public.success_wish_requests r
       where r.id=o.request_id and r.receiver_id=o.receiver_id
       and r.cancelled_at is null and r.expires_at>now()))
 );
 return found;
end $$;
revoke all on function public.success_wish_claim_guest_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.success_wish_claim_guest_payment(uuid,text) to service_role;

create or replace function public.success_wish_pin_correct_address(p_key text,p_phone text,p_epoch integer,p_link text) returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.success_wish_guest_orders;
begin
 if coalesce(p_key,'') !~ '^[a-f0-9]{64}$' or coalesce(p_link,'') !~ '^[a-f0-9]{64}$' or coalesce(p_phone,'') !~ '^\+254[17][0-9]{8}$' then return false;end if;
 select * into o from public.success_wish_guest_orders where key_hash=p_key for update;
 if o.id is null or o.group_cards is not null or o.state<>'settled' or o.refunded_at is not null or o.receiver_id is not null or o.inbox_claimed_at is not null or o.inbox_opened_at is not null or exists(select 1 from public.success_wish_guest_gifts where guest_order_id=o.id and opened_at is not null) then return false;end if;
 if coalesce(o.delivery_phone_override,o.card->>'deliveryPhone')=p_phone then return true;end if;
 if o.gift_access_epoch<>p_epoch then return false;end if;
 update public.success_wish_guest_orders set inbox_receiver_id=null,delivery_phone_override=p_phone,gift_access_epoch=gift_access_epoch+1 where id=o.id;
 update public.success_wish_guest_gifts set link_hash=p_link where guest_order_id=o.id;
 return true;
end $$;
revoke all on function public.success_wish_pin_correct_address(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.success_wish_pin_correct_address(text,text,integer,text) to service_role;
