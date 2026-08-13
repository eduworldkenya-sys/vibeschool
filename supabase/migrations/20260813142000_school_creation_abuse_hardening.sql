begin;

drop policy if exists insert_own_school on public.schools;

create or replace function public.create_school_with_admin(
  p_user_id uuid,p_full_name text,p_school_name text,p_subdomain text,p_county text default null,p_sub_county text default null,p_ward text default null,p_lat numeric default null,p_lng numeric default null,p_knec_code text default null,p_nemis_code text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_school_id uuid;v_existing uuid;v_existing_count integer;v_name_norm text;v_county_norm text;v_subcounty_norm text;v_uid uuid:=auth.uid();v_recent integer;
begin
 if v_uid is null or v_uid<>p_user_id then raise exception 'unauthorized_identity'; end if;
 if length(trim(coalesce(p_full_name,'')))<2 then raise exception 'invalid_full_name'; end if;
 if length(trim(coalesce(p_school_name,'')))<3 then raise exception 'invalid_school_name'; end if;
 if length(trim(coalesce(p_subdomain,'')))<3 then raise exception 'invalid_subdomain'; end if;
 v_name_norm:=lower(regexp_replace(trim(p_school_name),'[^a-zA-Z0-9]+','','g'));v_county_norm:=lower(trim(coalesce(p_county,'')));v_subcounty_norm:=lower(trim(coalesce(p_sub_county,'')));
 select count(*) into v_recent from public.schools s where s.created_by=v_uid and s.created_at>=now()-interval '24 hours';
 if v_recent>=1 and not coalesce(public.is_platform_owner(),false) then raise exception 'school_creation_rate_limited'; end if;
 select count(*),min(s.id) into v_existing_count,v_existing from public.schools s where s.deleted_at is null and s.status in ('pending','active') and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g'))=v_name_norm and lower(trim(coalesce(s.county,'')))=v_county_norm and (v_subcounty_norm='' or lower(trim(coalesce(s.sub_county,'')))=v_subcounty_norm);
 if v_existing_count>0 then raise exception 'school_already_exists:%',v_existing; end if;
 if nullif(trim(coalesce(p_knec_code,'')),'') is not null and exists(select 1 from public.schools where deleted_at is null and knec_code=trim(p_knec_code)) then raise exception 'school_code_already_exists'; end if;
 if nullif(trim(coalesce(p_nemis_code,'')),'') is not null and exists(select 1 from public.schools where deleted_at is null and nemis_code=trim(p_nemis_code)) then raise exception 'school_code_already_exists'; end if;
 if p_lat is not null and p_lng is not null and exists(select 1 from public.schools s where s.deleted_at is null and s.status in ('pending','active') and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g'))=v_name_norm and s.gps_lat is not null and s.gps_lng is not null and 6371*2*asin(sqrt(power(sin(radians((s.gps_lat-p_lat)/2)),2)+cos(radians(p_lat))*cos(radians(s.gps_lat))*power(sin(radians((s.gps_lng-p_lng)/2)),2)))<1.0) then raise exception 'school_identity_review_required'; end if;
 insert into public.schools(name,subdomain,timezone,status,country_code,requires_dual_approval,county,sub_county,ward,gps_lat,gps_lng,knec_code,nemis_code,name_normalized,school_type,directory_source,last_verified_at,created_by) values(trim(p_school_name),lower(trim(p_subdomain)),'Africa/Nairobi','pending','KE',true,nullif(trim(p_county),''),nullif(trim(p_sub_county),''),nullif(trim(p_ward),''),p_lat,p_lng,nullif(trim(p_knec_code),''),nullif(trim(p_nemis_code),''),v_name_norm,'UNCLASSIFIED','ADMIN_REQUEST',null,v_uid) returning id into v_school_id;
 insert into public.profiles(id,full_name,school_id,role) values(p_user_id,trim(p_full_name),v_school_id,'admin') on conflict(id) do update set full_name=excluded.full_name,school_id=excluded.school_id,role='admin';
 insert into public.school_members(school_id,profile_id,role,joined_at) values(v_school_id,p_user_id,'admin',now()) on conflict(school_id,profile_id) do update set role='admin';
 return v_school_id;
end;$$;
revoke all on function public.create_school_with_admin(uuid,text,text,text,text,text,text,numeric,numeric,text,text) from public,anon;
grant execute on function public.create_school_with_admin(uuid,text,text,text,text,text,text,numeric,numeric,text,text) to authenticated;

drop function if exists public.create_school_with_admin(uuid,text,text,text,text);

create or replace function public.guard_school_duplicate_identity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare n text;c text;sc text;existing uuid;
begin
 if coalesce(public.is_platform_owner(),false) then return new; end if;
 n:=lower(regexp_replace(trim(coalesce(new.name,'')),'[^a-zA-Z0-9]+','','g'));c:=lower(trim(coalesce(new.county,'')));sc:=lower(trim(coalesce(new.sub_county,'')));
 if n='' then raise exception 'invalid_school_identity'; end if;
 select s.id into existing from public.schools s where s.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid) and s.deleted_at is null and s.status in ('pending','active') and lower(regexp_replace(s.name,'[^a-zA-Z0-9]+','','g'))=n and lower(trim(coalesce(s.county,'')))=c and (sc='' or lower(trim(coalesce(s.sub_county,'')))=sc) limit 1;
 if existing is not null then raise exception 'school_identity_duplicate_blocked:%',existing; end if;
 return new;
end;$$;

drop trigger if exists trg_guard_school_duplicate_identity on public.schools;
create trigger trg_guard_school_duplicate_identity before insert on public.schools for each row execute function public.guard_school_duplicate_identity();
commit;