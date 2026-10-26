-- Run after both receiver migrations in an isolated PostgreSQL database.
-- Assertions fail if anonymous or authenticated clients can reach service-only child data.
do $$
declare table_name text;
declare relation_name text;
begin
  foreach table_name in array array[
    'success_wish_receivers','success_wish_cards','success_wish_card_access',
    'success_wish_card_sessions','success_wish_sms_deliveries',
    'success_wish_receiver_challenges','success_wish_receiver_sessions','success_wish_requests'
  ] loop
    relation_name := 'public.' || table_name;
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=table_name and c.relrowsecurity
    ) then raise exception 'Receiver relation % lacks RLS', relation_name; end if;
    if has_table_privilege('anon',relation_name,'SELECT')
      or has_table_privilege('anon',relation_name,'INSERT')
      or has_table_privilege('authenticated',relation_name,'SELECT')
      or has_table_privilege('authenticated',relation_name,'UPDATE')
      or has_table_privilege('authenticated',relation_name,'DELETE')
    then raise exception 'Receiver relation % exposed to untrusted role', relation_name; end if;
    if not has_table_privilege('service_role',relation_name,'SELECT')
      or not has_table_privilege('service_role',relation_name,'INSERT')
    then raise exception 'Receiver relation % missing service access', relation_name; end if;
  end loop;
  if has_function_privilege('anon','public.success_wish_consume_receiver_challenge(uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.success_wish_consume_receiver_challenge(uuid,uuid,text,text)','EXECUTE')
  then raise exception 'OTP consumption function was exposed'; end if;
  if has_function_privilege('anon','public.success_wish_assert_real_settlement()','EXECUTE')
    or has_function_privilege('authenticated','public.success_wish_assert_real_settlement()','EXECUTE')
  then raise exception 'Paid settlement guard was exposed'; end if;
end $$;
