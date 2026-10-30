-- Extend the canonical ledgers: delivery identity is independent of account access.
-- access: service-only public.success_wish_receivers
-- authorization-test: public.success_wish_receivers
-- access: service-only public.success_wish_receiver_sessions
-- authorization-test: public.success_wish_receiver_sessions
-- access: service-only public.success_wish_guest_orders
-- authorization-test: public.success_wish_guest_orders
-- access: service-only public.success_wish_guest_gifts
-- authorization-test: public.success_wish_guest_gifts
-- access: service-only public.success_wish_free_gifts
-- authorization-test: public.success_wish_free_gifts
-- A link-only gift need not have a phone address. PIN setup still validates its phone.
alter table public.success_wish_receivers alter column phone_e164 drop not null;
alter table public.success_wish_guest_gifts add column delivery_receiver_id uuid references public.success_wish_receivers(id);
alter table public.success_wish_free_gifts add column delivery_receiver_id uuid references public.success_wish_receivers(id);
alter table public.success_wish_guest_orders add column delivery_link_hashes text[];
-- Guest sessions are gift capabilities, never collection/account capabilities.
alter table public.success_wish_receiver_sessions alter column receiver_id drop not null;
alter table public.success_wish_receiver_sessions
 add column guest_browser_hash text check(guest_browser_hash is null or guest_browser_hash ~ '^[a-f0-9]{64}$'),
 add column guest_gift_id uuid references public.success_wish_guest_gifts(id) on delete cascade,
 add column free_gift_id uuid references public.success_wish_free_gifts(id) on delete cascade,
 add constraint success_wish_session_scope check (
  (guest_gift_id is null and free_gift_id is null and guest_browser_hash is null and receiver_id is not null)
  or (receiver_id is null and pin_epoch is null and guest_browser_hash is not null and num_nonnulls(guest_gift_id,free_gift_id)=1));

create function public.success_wish_delivery_recipient() returns trigger
language plpgsql security invoker set search_path='' as $$
declare c jsonb; target uuid; address text; o public.success_wish_guest_orders;
begin
 if tg_op='UPDATE' then
  if old.delivery_receiver_id is not null then
   if new.delivery_receiver_id is distinct from old.delivery_receiver_id then raise exception 'Delivery recipient cannot change';end if;
   return new;
  end if;
 end if;
 -- A recipient is selected only by an existing authorised collection reference.
 -- Never find an account by phone/name, even if there is only one matching row.
 if tg_table_name='success_wish_guest_gifts' then
  select * into o from public.success_wish_guest_orders where id=new.guest_order_id;
  c:=coalesce(new.card,o.card); target:=coalesce(new.inbox_receiver_id,o.inbox_receiver_id);
  address:=case when new.item_index is null then coalesce(o.delivery_phone_override,c->>'deliveryPhone') else c->>'deliveryPhone' end;
 else
  perform pg_advisory_xact_lock(hashtextextended(new.key_hash,0));
  select delivery_receiver_id into target from public.success_wish_free_gifts where key_hash=new.key_hash;
  if target is not null then new.delivery_receiver_id:=target;return new;end if;
  c:=new.card; target:=new.inbox_receiver_id; address:=c->>'deliveryPhone';
 end if;
 if target is null then
  -- Unknown recipients receive separate IDs; duplicate names and shared addresses are valid.
  insert into public.success_wish_receivers(display_name,school_label,phone_e164,pin_name_key,pin_exam_year)
   values(c->>'candidate',coalesce(c->>'school',''),case when address ~ '^[+]254[17][0-9]{8}$' then address else null end,
    lower(regexp_replace(btrim(c->>'candidate'),'\s+',' ','g')),c->>'examYear') returning id into target;
 end if;
 new.delivery_receiver_id:=target;
 return new;
end $$;
revoke all on function public.success_wish_delivery_recipient() from public,anon,authenticated;
create trigger success_wish_delivery_recipient before insert or update on public.success_wish_guest_gifts
 for each row execute function public.success_wish_delivery_recipient();
create trigger success_wish_delivery_recipient before insert or update on public.success_wish_free_gifts
 for each row execute function public.success_wish_delivery_recipient();
-- Existing cards/owners/links/payment evidence are preserved. Only missing identity refs are filled.
update public.success_wish_guest_gifts g set delivery_receiver_id=null where delivery_receiver_id is null
 and exists(select 1 from public.success_wish_guest_orders o where o.id=g.guest_order_id and o.state='settled' and o.refunded_at is null);
update public.success_wish_free_gifts set delivery_receiver_id=null where delivery_receiver_id is null;

create function public.success_wish_automatic_delivery() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.state='settled' and new.refunded_at is null and new.delivery_link_hashes is not null then
  if new.group_cards is not null then
   perform public.success_wish_issue_group_gifts(new.id,new.key_hash,new.delivery_link_hashes);
  elsif new.receiver_id is null then
   if cardinality(new.delivery_link_hashes)<>1 then raise exception 'One gift link required';end if;
   perform public.success_wish_issue_unrequested_guest_gift(new.id,new.key_hash,new.delivery_link_hashes[1]);
  end if;
 end if;
 return new;
end $$;
revoke all on function public.success_wish_automatic_delivery() from public,anon,authenticated;
create trigger success_wish_automatic_delivery after update of state on public.success_wish_guest_orders
 for each row when (old.state is distinct from new.state) execute function public.success_wish_automatic_delivery();
-- Freeze the delivery capabilities at order creation, alongside the existing immutable snapshots.
create function public.success_wish_delivery_links_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.delivery_link_hashes is distinct from old.delivery_link_hashes then
  raise exception 'Delivery links cannot change';
 end if;
 if new.delivery_link_hashes is not null and
  (cardinality(new.delivery_link_hashes)<>coalesce(jsonb_array_length(new.group_cards),1)
   or exists(select 1 from unnest(new.delivery_link_hashes) h where h is null or h !~ '^[a-f0-9]{64}$')) then
  raise exception 'Invalid delivery capabilities';
 end if;
 return new;
end $$;
revoke all on function public.success_wish_delivery_links_guard() from public,anon,authenticated;
create trigger success_wish_delivery_links_guard before insert or update on public.success_wish_guest_orders
 for each row execute function public.success_wish_delivery_links_guard();

create index success_wish_guest_browser_sessions on public.success_wish_receiver_sessions(guest_browser_hash) where guest_browser_hash is not null;
