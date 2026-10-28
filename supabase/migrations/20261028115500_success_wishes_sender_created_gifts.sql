-- Sender-created gift checkout. Nothing is automatically delivered to, or claimed by, a recipient.
-- Keep existing verified-recipient orders, paid-card contracts and both payment switches intact.
-- access: service-only public.success_wish_guest_gifts
-- authorization-test: public.success_wish_guest_gifts
alter table public.success_wish_guest_orders alter column request_id drop not null;
alter table public.success_wish_guest_orders alter column receiver_id drop not null;
alter table public.success_wish_guest_orders
  add constraint success_wish_guest_identity_pair
  check ((request_id is null and receiver_id is null) or (request_id is not null and receiver_id is not null));

-- Private gift bearer hashes never expose the sender's immutable message through the Data API.
create table public.success_wish_guest_gifts (
  id uuid primary key default gen_random_uuid(),
  guest_order_id uuid not null unique references public.success_wish_guest_orders(id),
  link_hash text not null unique check (link_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.success_wish_guest_gifts enable row level security;
revoke all on public.success_wish_guest_gifts from public, anon, authenticated;
grant select, insert, update on public.success_wish_guest_gifts to service_role;

-- One database claim per order, never two STK prompts; verification is NOT a sender requirement.
-- Legacy receiver-linked orders continue to require a verified, unexpired recipient request.
create or replace function public.success_wish_claim_guest_payment(p_id uuid,p_callback_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if coalesce(p_callback_hash,'') !~ '^[a-f0-9]{64}$' then return false; end if;
 if not exists(select 1 from public.mpesa_runtime_control
   where singleton and initiation_enabled and success_wishes_enabled) then return false; end if;
 update public.success_wish_guest_orders o
 set state='submitting',callback_hash=p_callback_hash,updated_at=now()
 where o.id=p_id and o.state='created' and o.created_at>now()-interval '24 hours'
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

-- Only a fully settled real-provider order can mint its one durable private bearer link.
-- Returns the same gift on retries; mismatched hashes can never overwrite the first issuance.
create function public.success_wish_issue_unrequested_guest_gift(
 p_id uuid,p_key_hash text,p_link_hash text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare o public.success_wish_guest_orders; g public.success_wish_guest_gifts;
begin
 if coalesce(p_key_hash,'') !~ '^[a-f0-9]{64}$'
    or coalesce(p_link_hash,'') !~ '^[a-f0-9]{64}$' then
   raise exception 'Invalid private gift key' using errcode='22023';
 end if;
 select * into o from public.success_wish_guest_orders
   where id=p_id and key_hash=p_key_hash for update;
 if o.id is null or o.receiver_id is not null or o.request_id is not null
   or o.state<>'settled' or o.refunded_at is not null
   or o.provider_verified_at is null or o.provider_receipt is null
   or o.settled_at is null or o.amount_kes<>50
 then raise exception 'Verified settled guest gift required' using errcode='23514'; end if;
 select * into g from public.success_wish_guest_gifts where guest_order_id=o.id;
 if g.id is not null then
   if g.link_hash<>p_link_hash then raise exception 'Gift key mismatch' using errcode='23514';end if;
   return g.id;
 end if;
 insert into public.success_wish_guest_gifts(guest_order_id,link_hash,expires_at)
 values(o.id,p_link_hash,o.settled_at+interval '90 days') returning * into g;
 return g.id;
end $$;
revoke all on function public.success_wish_issue_unrequested_guest_gift(uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.success_wish_issue_unrequested_guest_gift(uuid,text,text)
 to service_role;