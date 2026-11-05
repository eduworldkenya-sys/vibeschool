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
 and (length(btrim(coalesce(p_query,'')))=0
      or position(lower(left(btrim(p_query),80)) in lower(pp.username))>0
      or position(lower(left(btrim(p_query),80)) in lower(pp.display_name))>0
      or position(lower(left(btrim(p_query),80)) in lower(coalesce(pp.role_label,'')))>0)
 order by pp.updated_at desc, pp.username asc limit least(greatest(coalesce(p_limit,20),1),30)
$$;
revoke all on function public.global_discover_people(text,integer) from public;
grant execute on function public.global_discover_people(text,integer) to anon,authenticated;