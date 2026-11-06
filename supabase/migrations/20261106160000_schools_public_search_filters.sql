-- Bounded public school search filters over the canonical URL registry.
-- No new school identities; use the same public profile projection as v1.
create function public.schools_search_urls_public_v2(
 p_query text default null,
 p_county text default null,
 p_sub_county text default null,
 p_level text default null,
 p_limit integer default 100
)
returns table(
 slug text,source_kind text,source_id uuid,school_name text,county text,
 sub_county text,school_level text,ownership_type text,knec_code text,is_verified boolean
)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.* from public.school_url_public_rows() r
 where (nullif(btrim(p_query),'') is null or
        r.school_name ilike '%'||btrim(p_query)||'%' or exists(
          select 1 from public.school_public_url_directory_aliases a
          join public.schools_directory d on d.id=a.directory_id
          where a.slug=r.slug and d.name ilike '%'||btrim(p_query)||'%'))
   and (nullif(btrim(p_county),'') is null or lower(r.county)=lower(btrim(p_county)))
   and (nullif(btrim(p_sub_county),'') is null or lower(r.sub_county)=lower(btrim(p_sub_county)))
   and (nullif(btrim(p_level),'') is null or lower(r.school_level)=lower(btrim(p_level)))
 order by case when lower(r.school_name)=lower(btrim(p_query)) then 0 else 1 end,
          r.school_name,r.slug
 limit least(greatest(coalesce(p_limit,100),1),200)
$$;
revoke all on function public.schools_search_urls_public_v2(text,text,text,text,integer) from public;
grant execute on function public.schools_search_urls_public_v2(text,text,text,text,integer) to anon,authenticated;

create function public.schools_public_filter_options_v1(p_county text default null)
returns table(option_kind text,option_value text)
language sql stable security definer set search_path=public,pg_temp as $$
 select 'county'::text, btrim(r.county)::text
 from public.school_url_public_rows() r where nullif(btrim(r.county),'') is not null
 group by 2
 union
 select 'sub_county'::text, btrim(r.sub_county)::text
 from public.school_url_public_rows() r
 where nullif(btrim(p_county),'') is not null
   and lower(r.county)=lower(btrim(p_county))
   and nullif(btrim(r.sub_county),'') is not null
 group by 2
 union
 select 'level'::text,btrim(r.school_level)::text
 from public.school_url_public_rows() r
 where (nullif(btrim(p_county),'') is null or lower(r.county)=lower(btrim(p_county)))
  and nullif(btrim(r.school_level),'') is not null
 group by 2
 order by 1,2
$$;
revoke all on function public.schools_public_filter_options_v1(text) from public;
grant execute on function public.schools_public_filter_options_v1(text) to anon,authenticated;
