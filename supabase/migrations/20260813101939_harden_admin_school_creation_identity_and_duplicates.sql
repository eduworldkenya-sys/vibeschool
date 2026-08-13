create or replace function public.create_school_with_admin(p_user_id uuid,p_full_name text,p_school_name text,p_subdomain text,p_county text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_school_id uuid; v_existing uuid; v_name_norm text; v_county_norm text;
begin
 if auth.uid() is null or auth.uid()<>p_user_id then raise exception 'unauthorized_identity'; end if;
 if length(trim(coalesce(p_full_name,'')))<2 then raise exception 'invalid_full_name'; end if;
 if length(trim(coalesce(p_school_name,'')))<3 then raise exception 'invalid_school_name'; end if;
 v_name_norm=lower(regexp_replace(trim(p_school_name),'[^a-zA-Z0-9]+','','g'));
 v_county_norm=lower(trim(coalesce(p_county,'')));
 select id into v_existing from public.schools where deleted_at is null and lower(regexp_replace(name,'[^a-zA-Z0-9]+','','g'))=v_name_norm and lower(trim(coalesce(county,'')))=v_county_norm order by case when status='active' then 0 when status='pending' then 1 else 2 end limit 1;
 if v_existing is not null then raise exception 'school_already_exists:%',v_existing; end if;
 insert into public.schools(name,subdomain,timezone,status,country_code,requires_dual_approval,county,name_normalized,school_type,directory_source,last_verified_at) values(trim(p_school_name),lower(trim(p_subdomain)),'Africa/Nairobi','pending','KE',true,nullif(trim(p_county),''),v_name_norm,'UNCLASSIFIED','ADMIN_REQUEST',null) returning id into v_school_id;
 insert into public.profiles(id,full_name,school_id,role) values(p_user_id,trim(p_full_name),v_school_id,'admin') on conflict(id) do update set full_name=excluded.full_name,school_id=excluded.school_id,role='admin';
 insert into public.school_members(school_id,profile_id,role,joined_at) values(v_school_id,p_user_id,'admin',now()) on conflict(school_id,profile_id) do update set role='admin';
 return v_school_id;
end; $$;
revoke all on function public.create_school_with_admin(uuid,text,text,text,text) from public,anon; grant execute on function public.create_school_with_admin(uuid,text,text,text,text) to authenticated;