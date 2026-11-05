-- Resolve one indexed registry target before reading its public school fields.
create or replace function public.schools_resolve_url_public_v1(p_slug text default null,p_school_id uuid default null,p_directory_id uuid default null)
returns table(slug text,source_kind text,source_id uuid,school_name text,county text,sub_county text,school_level text,ownership_type text,knec_code text,is_verified boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 with target as materialized (
  select u.* from public.school_public_urls u
  where num_nonnulls(p_slug,p_school_id,p_directory_id)=1 and (
   (p_slug is not null and u.slug=lower(p_slug)) or
   (p_school_id is not null and u.school_id=p_school_id) or
   (p_directory_id is not null and (u.directory_id=p_directory_id or u.slug=(select a.slug from public.school_public_url_directory_aliases a where a.directory_id=p_directory_id))))
 )
 select u.slug,'canonical'::text,s.id,s.name::text,s.county::text,s.sub_county::text,s.school_category::text,s.ownership_type,s.knec_code::text,false
 from target u join public.schools s on s.id=u.school_id where s.deleted_at is null and s.status='active'
 union all
 select u.slug,'directory',d.id,d.name,d.county,d.sub_county,d.type,d.status,d.knec_code,coalesce(d.is_verified,false)
 from target u join public.schools_directory d on d.id=u.directory_id where lower(coalesce(d.status,''))<>'closed'
$$;
revoke all on function public.schools_resolve_url_public_v1(text,uuid,uuid) from public;
grant execute on function public.schools_resolve_url_public_v1(text,uuid,uuid) to anon,authenticated;
