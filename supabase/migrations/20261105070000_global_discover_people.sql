-- Search only explicitly public, active and non-anonymized Global profiles.
create or replace function public.global_discover_people(p_query text default '', p_limit integer default 20)
returns table(username text, display_name text, avatar_url text, role_label text, county text, institution text)
language sql stable security definer set search_path = public, pg_temp
as $$
 select pp.username,pp.display_name,pp.avatar_url,pp.role_label,pp.county,pp.institution
 from public.global_public_profiles pp
 join public.profiles p on p.id=pp.profile_id
 where pp.is_public=true and pp.username is not null and pp.display_name is not null
 and p.account_status='active'::public.account_status and p.is_anonymized=false
 and (length(btrim(coalesce(p_query,'')))=0 or
      pp.username ilike '%'||replace(replace(replace(left(btrim(p_query),80),'\\','\\\\'),'%','\\%'),'_','\\_')||'%' escape '\'
      or pp.display_name ilike '%'||replace(replace(replace(left(btrim(p_query),80),'\\','\\\\'),'%','\\%'),'_','\\_')||'%' escape '\'
      or coalesce(pp.role_label,'') ilike '%'||replace(replace(replace(left(btrim(p_query),80),'\\','\\\\'),'%','\\%'),'_','\\_')||'%' escape '\')
 order by pp.updated_at desc, pp.username asc limit least(greatest(coalesce(p_limit,20),1),30)
$$;
revoke all on function public.global_discover_people(text,integer) from public;
grant execute on function public.global_discover_people(text,integer) to anon,authenticated;