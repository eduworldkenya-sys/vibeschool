-- Success Card 2026: 200 promotional redemptions, independent of paid checkout.
-- access: service-only public.success_wishes_campaigns
-- authorization-test: public.success_wishes_campaigns
create table public.success_wishes_campaigns (
 code text primary key,
 title text not null,
 max_redemptions integer not null check (max_redemptions > 0),
 redeemed integer not null default 0 check (redeemed >= 0 and redeemed <= max_redemptions),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.success_wishes_campaigns enable row level security;
revoke all on public.success_wishes_campaigns from public, anon, authenticated;
grant select, update on public.success_wishes_campaigns to service_role;
insert into public.success_wishes_campaigns(code,title,max_redemptions,enabled)
values ('DNJIMAX3','Success Card 2026',200,false);

create function public.success_wish_redeem_campaign(
 p_code text,p_key_hash text,p_link_hash text,p_card jsonb,p_card_digest text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
 existing public.success_wish_free_gifts;
 gift_id uuid;
begin
 if upper(trim(coalesce(p_code,''))) <> 'DNJIMAX3' then
  raise exception 'Invalid code' using errcode='22023';
 end if;
 perform 1 from public.success_wishes_campaigns where code='DNJIMAX3' and enabled for update;
 if not found then raise exception 'Campaign unavailable' using errcode='23514'; end if;
 select * into existing from public.success_wish_free_gifts where key_hash=p_key_hash;
 if existing.id is not null then
  if existing.card_digest<>p_card_digest or existing.card<>p_card or existing.link_hash<>p_link_hash
  then raise exception 'Gift key conflict' using errcode='23505'; end if;
  return existing.id;
 end if;
 update public.success_wishes_campaigns set redeemed=redeemed+1
  where code='DNJIMAX3' and enabled and redeemed<max_redemptions;
 if not found then raise exception 'All codes claimed' using errcode='23514'; end if;
 if coalesce(p_key_hash,'') !~ '^[a-f0-9]{64}$'
 or coalesce(p_link_hash,'') !~ '^[a-f0-9]{64}$'
 or coalesce(p_card_digest,'') !~ '^[a-f0-9]{64}$'
 or coalesce(p_card->>'kind','') <> 'success_wish_text'
 or coalesce(p_card->>'theme','') not in ('heritage','botanical','nightfall','sunrise')
 or length(trim(coalesce(p_card->>'candidate',''))) not between 1 and 48
 or length(trim(coalesce(p_card->>'sender',''))) not between 1 and 48
 or length(trim(coalesce(p_card->>'message',''))) not between 1 and 220
 or coalesce(p_card->>'examYear','') !~ '^20[0-9]{2}$'
 or length(coalesce(p_card->>'school','')) > 80
 then raise exception 'Invalid card' using errcode='22023'; end if;
 insert into public.success_wish_free_gifts(key_hash,link_hash,card,card_digest,expires_at)
 values(p_key_hash,p_link_hash,p_card,p_card_digest,now()+interval '90 days')
 returning id into gift_id;
 return gift_id;
end $$;
revoke all on function public.success_wish_redeem_campaign(text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.success_wish_redeem_campaign(text,text,text,jsonb,text) to service_role;
