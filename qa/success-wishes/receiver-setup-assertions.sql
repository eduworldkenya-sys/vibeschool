-- SYNTHETIC ONLY: pre-payment recipient setup requires no paid card.
begin;
do $$
declare r uuid; denied boolean; route text;
begin
 if has_table_privilege('anon','public.success_wish_receivers','SELECT')
 or has_table_privilege('authenticated','public.success_wish_receivers','UPDATE') then
   raise exception 'Receiver setup exposed to public roles';
 end if;
 insert into public.success_wish_receivers(display_name,phone_e164,consent_route,setup_token_hash,setup_expires_at)
 values('SYNTHETIC adult','+254700000000','adult',repeat('f',64),now()+interval '1 hour') returning id into r;
 if (select consent_status from public.success_wish_receivers where id=r)<>'pending' then
   raise exception 'Setup capability must not confer consent';
 end if;
 foreach route in array array['guardian',null] loop
   denied:=false;
   begin update public.success_wish_receivers set consent_route=route where id=r;
   exception when check_violation then denied:=true; end;
   if not denied then raise exception 'Setup accepted a non-adult consent route';end if;
 end loop;
 denied:=false;
 begin update public.success_wish_receivers set setup_expires_at=now()+interval '2 days' where id=r;
 exception when check_violation then denied:=true; end;
 if not denied then raise exception 'Unbounded setup capability';end if;
 denied:=false;
 begin update public.success_wish_receivers set setup_token_hash=null where id=r;
 exception when check_violation then denied:=true; end;
 if not denied then raise exception 'Incomplete setup capability';end if;
end $$;
rollback;
