-- Free pilot gifts use a distinct durable state and never spoof M-Pesa settlement.
-- access: service-only public.success_wish_guest_orders
-- authorization-test: public.success_wish_guest_orders
create table public.success_wishes_pilot_control (
 singleton boolean primary key default true check(singleton),
 free_text_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.success_wishes_pilot_control(singleton,free_text_enabled) values(true,false);
alter table public.success_wishes_pilot_control enable row level security;
revoke all on public.success_wishes_pilot_control from public,anon,authenticated;
grant select on public.success_wishes_pilot_control to service_role;

alter table public.success_wish_guest_orders alter column payer_phone drop not null;
alter table public.success_wish_guest_orders drop constraint if exists success_wish_guest_orders_amount_kes_check;
alter table public.success_wish_guest_orders add constraint success_wish_guest_orders_amount_kes_check check(
 (amount_kes=50 and state<>'free_issued') or (amount_kes=0 and state='free_issued')
);
alter table public.success_wish_guest_orders drop constraint if exists success_wish_guest_orders_state_check;
alter table public.success_wish_guest_orders add constraint success_wish_guest_orders_state_check check(
 state in ('created','submitting','awaiting_customer','reconciliation_required','settled','failed','refunded','free_issued')
);
alter table public.success_wish_guest_orders add constraint success_wish_free_issuance_integrity check(
 state<>'free_issued' or (payer_phone is null and request_id is null and receiver_id is null
 and checkout_id is null and merchant_id is null and callback_hash is null
 and provider_receipt is null and callback_event is null and provider_query is null
 and provider_verified_at is null and settled_at is null and refunded_at is null)
);
alter table public.success_wish_guest_orders add constraint success_wish_paid_payer_required check(
 state='free_issued' or payer_phone is not null
);

create function public.success_wish_issue_free_guest_gift(
 p_key_hash text,p_link_hash text,p_card jsonb,p_card_digest text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare o public.success_wish_guest_orders; g public.success_wish_guest_gifts;
begin
 if coalesce(p_key_hash,'') !~ '^[a-f0-9]{64}$'
 or coalesce(p_link_hash,'') !~ '^[a-f0-9]{64}$'
 or coalesce(p_card_digest,'') !~ '^[a-f0-9]{64}$'
 or coalesce(p_card->>'kind','')<>'success_wish_text'
 or coalesce(p_card->>'theme','') not in ('heritage','botanical','nightfall','sunrise')
 or length(trim(coalesce(p_card->>'candidate',''))) not between 1 and 48
 or length(trim(coalesce(p_card->>'sender',''))) not between 1 and 48
 or length(trim(coalesce(p_card->>'message',''))) not between 1 and 220
 or coalesce(p_card->>'examYear','') !~ '^20[0-9]{2}$'
 or length(coalesce(p_card->>'school',''))>80
 then raise exception 'Invalid free gift' using errcode='22023'; end if;
 if not exists(select 1 from public.success_wishes_pilot_control where singleton and free_text_enabled)
 then raise exception 'Free wishes are disabled' using errcode='23514'; end if;
 insert into public.success_wish_guest_orders(key_hash,card,card_digest,payer_phone,amount_kes,state)
 values(p_key_hash,p_card,p_card_digest,null,0,'free_issued')
 on conflict(key_hash) do nothing;
 select * into o from public.success_wish_guest_orders where key_hash=p_key_hash for update;
 if o.id is null or o.state<>'free_issued' or o.amount_kes<>0
 or o.card_digest<>p_card_digest or o.card<>p_card
 then raise exception 'Free gift key conflict' using errcode='23505'; end if;
 select * into g from public.success_wish_guest_gifts where guest_order_id=o.id;
 if g.id is not null then
  if g.link_hash<>p_link_hash then raise exception 'Gift link mismatch' using errcode='23514'; end if;
  return g.id;
 end if;
 insert into public.success_wish_guest_gifts(guest_order_id,link_hash,expires_at)
 values(o.id,p_link_hash,now()+interval '90 days') returning * into g;
 return g.id;
end $$;
revoke all on function public.success_wish_issue_free_guest_gift(text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.success_wish_issue_free_guest_gift(text,text,jsonb,text) to service_role;
