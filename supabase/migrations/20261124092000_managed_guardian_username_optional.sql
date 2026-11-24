-- #1984: a parent/verified teacher may create a managed learner without
-- first claiming a personal username. Guardian declaration + verified account
-- still required. The child's username remains mandatory and globally unique.
begin;
create or replace function public.vs_create_managed_learner(p_username text,p_display_name text,p_grade text default null,p_guardian_confirmed boolean default false)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare
 v_uid uuid:=auth.uid();
 v_guardian uuid;
 v_child uuid;
 v_username text:=lower(trim(leading '@' from trim(coalesce(p_username,''))));
 v_access jsonb;
begin
 if v_uid is null then raise exception 'Sign in required' using errcode='28000'; end if;
 if v_username !~ '^[a-z][a-z0-9_]{2,23}$' or char_length(trim(coalesce(p_display_name,''))) not between 1 and 80 then
  raise exception 'Invalid learner details' using errcode='22023';
 end if;
 if char_length(coalesce(p_grade,''))>60 then raise exception 'Invalid grade' using errcode='22023'; end if;
 if p_guardian_confirmed is distinct from true then raise exception 'Guardian declaration required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(v_username)::bigint);
 if exists(select 1 from public.vs_username_reservations where username=v_username) then
  raise exception 'Username unavailable' using errcode='23505';
 end if;
 v_access:=public.get_my_auth_access_state();
 if v_access->>'account_status' is distinct from 'active' or v_access->>'is_anonymized' is distinct from 'false' then
  raise exception 'Account unavailable' using errcode='28000';
 end if;
 if coalesce(v_access->>'role','') not in ('parent','teacher') then
  raise exception 'Verified adult account required' using errcode='42501';
 end if;
 if not exists (select 1 from auth.users where id=v_uid and email_confirmed_at is not null) then
  raise exception 'Verified email required' using errcode='42501';
 end if;
 if exists(select 1 from public.global_public_profiles where lower(trim(username))=v_username) then
  raise exception 'Username unavailable' using errcode='23505';
 end if;
 -- A guardian's personal @username is optional. Their verified Auth identity
 -- and canonical adult role authorize the child; no additional registration.
 insert into public.vs_identities(auth_user_id,kind)
   values(v_uid,'person') on conflict(auth_user_id) do nothing;
 select id into v_guardian from public.vs_identities
   where auth_user_id=v_uid and kind='person' for update;
 if v_guardian is null then raise exception 'Guardian identity unavailable' using errcode='42501'; end if;
 if (select count(*) from public.vs_managed_learners where guardian_identity_id=v_guardian) >= 20 then
  raise exception 'Managed learner limit reached' using errcode='54000';
 end if;
 insert into public.vs_identities(username,display_name,kind)
  values(v_username,trim(p_display_name),'managed_learner') returning id into v_child;
 insert into public.vs_managed_learners(learner_identity_id,guardian_identity_id,grade_label,guardian_confirmed_at)
  values(v_child,v_guardian,nullif(trim(coalesce(p_grade,'')),''),now());
 return jsonb_build_object('id',v_child,'username',v_username);
exception when unique_violation then
 raise exception 'Username unavailable' using errcode='23505';
end;
$$;
revoke all on function public.vs_create_managed_learner(text,text,text,boolean) from public,anon;
grant execute on function public.vs_create_managed_learner(text,text,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
