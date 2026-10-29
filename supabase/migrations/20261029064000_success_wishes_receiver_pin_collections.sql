-- Canonical receiver/session extension. Phone is an address, never identity proof.
-- access: service-only public.success_wish_receivers
-- authorization-test: public.success_wish_receivers
-- access: service-only public.success_wish_receiver_sessions
-- authorization-test: public.success_wish_receiver_sessions
-- access: service-only public.success_wish_guest_orders
-- authorization-test: public.success_wish_guest_orders
-- access: service-only public.success_wish_free_gifts
-- authorization-test: public.success_wish_free_gifts
alter table public.success_wish_receivers
 add column pin_hash text check(pin_hash is null or pin_hash ~ '^[a-f0-9]{32}:[a-f0-9]{64}$'),
 add column pin_name_key text,
 add column pin_exam_year text check(pin_exam_year is null or pin_exam_year ~ '^20[0-9]{2}$'),
 add column pin_epoch integer not null default 0,
 add column pin_setup_hash text unique,
 add column pin_recovery_hash text unique,
 add column pin_previous_recovery_hash text,
 add column pin_reset_hash text,
 add column pin_notice_version text,
 add column pin_consent_role text check(pin_consent_role in ('adult','guardian')),
 add column pin_consent_at timestamptz;
-- Duplicate names and shared phones are valid. Matching data must never claim another collection.
create index success_wish_pin_login_idx on public.success_wish_receivers(phone_e164,pin_name_key) where pin_hash is not null;
alter table public.success_wish_receiver_sessions add column pin_epoch integer;
alter table public.success_wish_guest_orders
 add column inbox_receiver_id uuid references public.success_wish_receivers(id),
 add column inbox_opened_at timestamptz,
 add column inbox_claimed_at timestamptz,
 add column inbox_request_hash text check(inbox_request_hash is null or inbox_request_hash ~ '^[a-f0-9]{64}$'),
 add column gift_access_epoch integer not null default 0,
 add column delivery_phone_override text;
alter table public.success_wish_free_gifts
 add column inbox_receiver_id uuid references public.success_wish_receivers(id),
 add column inbox_opened_at timestamptz,
 add column inbox_claimed_at timestamptz;
create index success_wish_guest_inbox_idx on public.success_wish_guest_orders(inbox_receiver_id,created_at desc) where inbox_receiver_id is not null;
create index success_wish_free_inbox_idx on public.success_wish_free_gifts(inbox_receiver_id,created_at desc) where inbox_receiver_id is not null;
create function public.success_wish_pin_owner_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='success_wish_guest_orders' then
  if new.inbox_request_hash is distinct from old.inbox_request_hash then raise exception 'A saved recipient request cannot change';end if;
 end if;
 if old.inbox_receiver_id is not null and new.inbox_receiver_id is distinct from old.inbox_receiver_id then
  if tg_table_name<>'success_wish_guest_orders' then raise exception 'Claimed gift cannot move';end if;
  if not (new.inbox_receiver_id is null and old.inbox_claimed_at is null and old.inbox_opened_at is null and new.gift_access_epoch=old.gift_access_epoch+1)then raise exception 'Claimed gift cannot move';end if;
 end if;
 return new;
end $$;
revoke all on function public.success_wish_pin_owner_guard() from public,anon,authenticated;
create trigger success_wish_pin_guest_owner before update on public.success_wish_guest_orders for each row execute function public.success_wish_pin_owner_guard();
create trigger success_wish_pin_free_owner before update on public.success_wish_free_gifts for each row execute function public.success_wish_pin_owner_guard();
create function public.success_wish_pin_claim(p_receiver uuid,p_link_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.success_wish_receivers;g public.success_wish_guest_gifts;o public.success_wish_guest_orders;f public.success_wish_free_gifts;
begin
 select * into r from public.success_wish_receivers where id=p_receiver and pin_hash is not null and consent_status<>'revoked';
 if r.id is null or coalesce(p_link_hash,'') !~ '^[a-f0-9]{64}$' then return false;end if;
 select * into g from public.success_wish_guest_gifts where link_hash=p_link_hash and revoked_at is null and expires_at>now();
 if g.id is not null then
  select * into o from public.success_wish_guest_orders where id=g.guest_order_id for update;
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
create function public.success_wish_pin_recover(p_old text,p_new text,p_pin text,p_request text,p_session text)
returns table(id uuid,pin_epoch integer) language plpgsql security invoker set search_path='' as $$
declare r public.success_wish_receivers;
begin
 if coalesce(p_old,'') !~ '^[a-f0-9]{64}$' or coalesce(p_new,'') !~ '^[a-f0-9]{64}$' or coalesce(p_request,'') !~ '^[a-f0-9]{64}$' or coalesce(p_session,'') !~ '^[a-f0-9]{64}$' or coalesce(p_pin,'') !~ '^[a-f0-9]{32}:[a-f0-9]{64}$' then return;end if;
 select * into r from public.success_wish_receivers where pin_recovery_hash=p_old and pin_hash is not null and consent_status<>'revoked' for update;
 if r.id is null then
  select * into r from public.success_wish_receivers where pin_previous_recovery_hash=p_old and pin_reset_hash=p_request and pin_recovery_hash=p_new and pin_hash=p_pin and consent_status<>'revoked' for update;
  if r.id is null then return;end if;
 else
  update public.success_wish_receivers set pin_hash=p_pin,pin_recovery_hash=p_new,pin_previous_recovery_hash=p_old,pin_reset_hash=p_request,pin_epoch=r.pin_epoch+1 where success_wish_receivers.id=r.id;
  delete from public.success_wish_receiver_sessions where receiver_id=r.id;
  r.pin_epoch:=r.pin_epoch+1;
 end if;
 insert into public.success_wish_receiver_sessions(receiver_id,token_hash,pin_epoch,expires_at) values(r.id,p_session,r.pin_epoch,now()+interval '90 days') on conflict(token_hash) do nothing;
 return query select r.id,r.pin_epoch;
end $$;
revoke all on function public.success_wish_pin_recover(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.success_wish_pin_recover(text,text,text,text,text) to service_role;
create function public.success_wish_pin_correct_address(p_key text,p_phone text,p_epoch integer,p_link text) returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.success_wish_guest_orders;
begin
 if coalesce(p_key,'') !~ '^[a-f0-9]{64}$' or coalesce(p_link,'') !~ '^[a-f0-9]{64}$' or coalesce(p_phone,'') !~ '^\+254[17][0-9]{8}$' then return false;end if;
 select * into o from public.success_wish_guest_orders where key_hash=p_key for update;
 if o.id is null or o.state<>'settled' or o.refunded_at is not null or o.receiver_id is not null or o.inbox_claimed_at is not null or o.inbox_opened_at is not null or exists(select 1 from public.success_wish_guest_gifts where guest_order_id=o.id and opened_at is not null) then return false;end if;
 if coalesce(o.delivery_phone_override,o.card->>'deliveryPhone')=p_phone then return true;end if;
 if o.gift_access_epoch<>p_epoch then return false;end if;
 update public.success_wish_guest_orders set inbox_receiver_id=null,delivery_phone_override=p_phone,gift_access_epoch=gift_access_epoch+1 where id=o.id;
 update public.success_wish_guest_gifts set link_hash=p_link where guest_order_id=o.id;
 return true;
end $$;
revoke all on function public.success_wish_pin_correct_address(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.success_wish_pin_correct_address(text,text,integer,text) to service_role;
create function public.success_wish_pin_open_gift(p_link text) returns boolean language plpgsql security invoker set search_path='' as $$
declare g public.success_wish_guest_gifts;o public.success_wish_guest_orders;
begin
 select * into g from public.success_wish_guest_gifts where link_hash=p_link and revoked_at is null and expires_at>now();
 if g.id is null then return false;end if;
 select * into o from public.success_wish_guest_orders where id=g.guest_order_id for update;
 if o.state<>'settled' or o.amount_kes<>50 or o.refunded_at is not null or o.provider_receipt is null or o.provider_verified_at is null or o.settled_at is null then return false;end if;
 update public.success_wish_guest_gifts set opened_at=coalesce(opened_at,now()) where id=g.id and link_hash=p_link and revoked_at is null and expires_at>now();
 if not found then return false;end if;
 update public.success_wish_guest_orders set inbox_opened_at=coalesce(inbox_opened_at,now()),inbox_claimed_at=coalesce(inbox_claimed_at,now()) where id=o.id;
 return true;
end $$;
revoke all on function public.success_wish_pin_open_gift(text) from public,anon,authenticated;
grant execute on function public.success_wish_pin_open_gift(text) to service_role;
