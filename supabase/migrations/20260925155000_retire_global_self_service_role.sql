begin;
create or replace function public.claim_my_initial_role(p_role text) returns text language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_current text;
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_role is null or p_role not in ('teacher','parent') then raise exception 'role_not_self_service' using errcode='22023'; end if;
 select role::text into v_current from public.profiles where id=v_uid for update;
 if not found then
   insert into public.profiles(id,role,account_status,is_anonymized) values(v_uid,p_role,'active',false);
   return p_role;
 end if;
 if v_current is null then update public.profiles set role=p_role where id=v_uid; return p_role; end if;
 if v_current<>p_role then raise exception 'role_already_claimed' using errcode='42501'; end if;
 return v_current;
end $$;
revoke all on function public.claim_my_initial_role(text) from public,anon,service_role;
grant execute on function public.claim_my_initial_role(text) to authenticated;
notify pgrst,'reload schema';
commit;