-- Free pilot gifts use a distinct durable state and never spoof M-Pesa settlement.
-- access: service-only public.success_wish_guest_orders
-- authorization-test: public.success_wish_guest_orders
-- access: service-only public.success_wishes_pilot_control
-- authorization-test: public.success_wishes_pilot_control
create table public.success_wishes_pilot_control (
 singleton boolean primary key default true check(singleton),
 free_text_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.success_wishes_pilot_control(singleton,free_text_enabled) values(true,false);
alter table public.success_wishes_pilot_control enable row level security;
revoke all on public.success_wishes_pilot_control from public,anon,authenticated;
grant select on public.success_wishes_pilot_control to service_role;

-- Free pilot is intentionally isolated: no modifications to the paid-order table or its constraints.
-- access: service-only public.success_wish_free_gifts
-- authorization-test: public.success_wish_free_gifts
create table public.success_wish_free_gifts(
 id uuid primary key default gen_random_uuid(),
 key_hash text not null unique check(key_hash ~ '^[a-f0-9]{64}$'),
 link_hash text not null unique check(link_hash ~ '^[a-f0-9]{64}$'),
 card jsonb not null check(card->>'kind'='success_wish_text'),
 card_digest text not null check(card_digest ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 opened_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.success_wish_free_gifts enable row level security;
revoke all on public.success_wish_free_gifts from public,anon,authenticated;
grant select,insert,update on public.success_wish_free_gifts to service_role;
create function public.success_wish_free_gift_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if row(new.key_hash,new.link_hash,new.card,new.card_digest,new.expires_at,new.created_at)
 is distinct from row(old.key_hash,old.link_hash,old.card,old.card_digest,old.expires_at,old.created_at)
 then raise exception 'A free gift cannot be edited'; end if;
 return new;
end $$;
revoke all on function public.success_wish_free_gift_immutable() from public,anon,authenticated;
create trigger success_wish_free_gift_immutable before update on public.success_wish_free_gifts
 for each row execute function public.success_wish_free_gift_immutable();

create function public.success_wish_issue_free_guest_gift(
 p_key_hash text,p_link_hash text,p_card jsonb,p_card_digest text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare g public.success_wish_free_gifts;
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
 insert into public.success_wish_free_gifts(key_hash,link_hash,card,card_digest,expires_at)
 values(p_key_hash,p_link_hash,p_card,p_card_digest,now()+interval '90 days')
 on conflict(key_hash) do nothing;
 select * into g from public.success_wish_free_gifts where key_hash=p_key_hash for update;
 if g.id is null or g.card_digest<>p_card_digest or g.card<>p_card or g.link_hash<>p_link_hash
 then raise exception 'Free gift key conflict' using errcode='23505'; end if;
 if g.revoked_at is not null or g.expires_at<=now()
 then raise exception 'Free gift unavailable' using errcode='23514'; end if;
 return g.id;
end $$;
revoke all on function public.success_wish_issue_free_guest_gift(text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.success_wish_issue_free_guest_gift(text,text,jsonb,text) to service_role;
