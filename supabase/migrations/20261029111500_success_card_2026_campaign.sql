-- Success Card 2026: limited promotional redemption, independent of M-Pesa.
-- Access: service-role only.
create table public.success_wishes_campaigns (
 code text primary key,
 title text not null,
 max_redemptions integer not null check(max_redemptions > 0),
 redeemed integer not null default 0 check(redeemed >= 0 and redeemed <= max_redemptions),
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
declare existing public.success_wish_free_gifts; gift_id uuid;
begin
 if upper(trim(coalesce(p_code,''))) <> 'DNJIMAX3' then
   raise exception 'Invalid code' using errcode='22023';
 end if;
 -- Lock the campaign before checking the quota, so concurrent requests stay under 200.
 perform 1 from public.success_wishes_campaigns
  where code='DNJIMAX3' and enabled for update;
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
 -- Existing free-gift issuance keeps the paid order system untouched.
 gift_id := public.success_wish_issue_free_guest_gift(p_key_hash,p_link_hash,p_card,p_card_digest);
 return gift_id;
end $$;
revoke all on function public.success_wish_redeem_campaign(text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.success_wish_redeem_campaign(text,text,text,jsonb,text) to service_role;
