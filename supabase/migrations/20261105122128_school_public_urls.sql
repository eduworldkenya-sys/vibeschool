-- access: owner-only public.school_public_urls
-- authorization-test: public.school_public_urls scripts/test-school-urls.mjs (anon SELECT/UPDATE denied)
-- access: owner-only public.school_public_url_directory_aliases
-- authorization-test: public.school_public_url_directory_aliases scripts/test-school-urls.mjs (no public table grants)
-- Stable public addresses. URL allocation never creates/merges school identities.
-- Registry is private; public RPCs return only the existing public profile projection.
create table public.school_public_urls (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  school_id uuid unique references public.schools(id) on delete restrict,
  directory_id uuid unique references public.schools_directory(id) on delete restrict,
  identity_note text not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(school_id,directory_id)=1)
);
alter table public.school_public_urls enable row level security;
revoke all on public.school_public_urls from public,anon,authenticated;

-- Explicit, reviewed cross-source aliases, never a name-based automatic merge.
create table public.school_public_url_directory_aliases (
 directory_id uuid primary key references public.schools_directory(id) on delete restrict,
 slug text not null references public.school_public_urls(slug) on delete restrict,
 identity_note text not null
);
alter table public.school_public_url_directory_aliases enable row level security;
revoke all on public.school_public_url_directory_aliases from public,anon,authenticated;

create function public.school_url_slug_base(p_name text) returns text
language sql immutable security invoker set search_path=public,pg_temp as $$
 select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(p_name,'')), '[^a-z0-9]+','-','g')),''),'school')
$$;
revoke all on function public.school_url_slug_base(text) from public,anon,authenticated;

create function public.school_url_allocate(p_id uuid,p_kind text,p_name text,p_county text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare base text:=public.school_url_slug_base(p_name); candidate text:=base; n integer:=0;
begin
 if p_kind not in ('canonical','directory') then raise exception 'invalid_source'; end if;
 if exists(select 1 from public.school_public_urls where (p_kind='canonical' and school_id=p_id) or (p_kind='directory' and directory_id=p_id))
 or (p_kind='directory' and exists(select 1 from public.school_public_url_directory_aliases where directory_id=p_id)) then return;end if;
 loop
  begin
   insert into public.school_public_urls(slug,school_id,directory_id,identity_note)
   values(candidate,case when p_kind='canonical' then p_id end,case when p_kind='directory' then p_id end,'Exact source record ID; no automatic identity merge');
   return;
  exception when unique_violation then
   -- Retry concurrent slug allocation; an existing source identity is already done.
   if exists(select 1 from public.school_public_urls where school_id=p_id or directory_id=p_id) then return;end if;
   n:=n+1;
   candidate:=base||'-'||public.school_url_slug_base(p_county);
   if n>1 then candidate:=candidate||'-'||replace(p_id::text,'-','');end if;
   if n>2 then raise exception 'school_url_allocation_conflict';end if;
  end;
 end loop;
end $$;
revoke all on function public.school_url_allocate(uuid,text,text,text) from public,anon,authenticated;

-- These names AND locations are guards against applying a curated slug to another ID.
insert into public.school_public_urls(slug,school_id,identity_note)
select 'gilgiltownship',id,'Reviewed canonical Gilgil Township, Nakuru/Gilgil; PR 1096'
from public.schools where id='c51ec2ae-5b70-4f69-887d-54eb9f312db7' and name='Gilgil Township' and county='Nakuru' and sub_county='Gilgil';
insert into public.school_public_urls(slug,directory_id,identity_note)
select 'municipality-mariakani-primary',id,'Laikipia record, historical Municipality Mariakani Primary; not Mariakani in Kilifi or Nairobi; current verification unchanged'
from public.schools_directory where id='3bdac02b-99cb-4342-a969-3a060300858e' and name='2005 Municipality Mariakani Pri Sch' and county='Laikipia' and type='Primary';
insert into public.school_public_url_directory_aliases(directory_id,slug,identity_note)
select d.id,u.slug,'Reviewed Gilgil Township primary directory alias in Nakuru; special unit is a separate school'
from public.schools_directory d cross join public.school_public_urls u
where u.slug='gilgiltownship' and d.county='Nakuru' and d.type='Primary'
 and ((d.id='88d921f6-2be1-4abb-ab1b-af82283f07a9' and d.name='Gilgil Township' and d.sub_county='Gilgil')
 or (d.id='a8c3cce5-21f1-4594-8684-7a175a74fb56' and d.name='Gilgil Township Pri Sch' and abs(d.latitude-(-0.501556))<0.00001 and abs(d.longitude-36.323889)<0.00001));

do $$ declare r record;begin
 for r in select id,name,county from public.schools where deleted_at is null and status='active' order by name,id loop
 perform public.school_url_allocate(r.id,'canonical',r.name,r.county);end loop;
 for r in select id,name,county from public.schools_directory where lower(coalesce(status,''))<>'closed' order by name,id loop
 perform public.school_url_allocate(r.id,'directory',r.name,r.county);end loop;
end $$;

create function public.school_url_on_source_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if TG_TABLE_NAME='schools' then
 if new.deleted_at is null and new.status='active' then perform public.school_url_allocate(new.id,'canonical',new.name,new.county);end if;
 else
 if lower(coalesce(new.status,''))<>'closed' then perform public.school_url_allocate(new.id,'directory',new.name,new.county);end if;
 end if;
 return new;
end $$;
revoke all on function public.school_url_on_source_change() from public,anon,authenticated;
create trigger school_public_url_allocate after insert or update of name,county,status,deleted_at on public.schools for each row execute function public.school_url_on_source_change();
create trigger directory_public_url_allocate after insert or update of name,county,status on public.schools_directory for each row execute function public.school_url_on_source_change();

-- Internal read projection excludes inactive records on every request.
create function public.school_url_public_rows() returns table(slug text,source_kind text,source_id uuid,school_name text,county text,sub_county text,school_level text,ownership_type text,knec_code text,is_verified boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 select u.slug,'canonical'::text,s.id,s.name::text,s.county::text,s.sub_county::text,s.school_category::text,s.ownership_type,s.knec_code::text,false
 from public.school_public_urls u join public.schools s on s.id=u.school_id where s.deleted_at is null and s.status='active'
 union all
 select u.slug,'directory',d.id,d.name,d.county,d.sub_county,d.type,d.status,d.knec_code,coalesce(d.is_verified,false)
 from public.school_public_urls u join public.schools_directory d on d.id=u.directory_id where lower(coalesce(d.status,''))<>'closed'
$$;
revoke all on function public.school_url_public_rows() from public,anon,authenticated;

create function public.schools_resolve_url_public_v1(p_slug text default null,p_school_id uuid default null,p_directory_id uuid default null)
returns table(slug text,source_kind text,source_id uuid,school_name text,county text,sub_county text,school_level text,ownership_type text,knec_code text,is_verified boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.* from public.school_url_public_rows() r
 where num_nonnulls(p_slug,p_school_id,p_directory_id)=1 and (
 (p_slug is not null and r.slug=lower(p_slug)) or
 (p_school_id is not null and r.source_kind='canonical' and r.source_id=p_school_id) or
 (p_directory_id is not null and ((r.source_kind='directory' and r.source_id=p_directory_id) or r.slug=(select a.slug from public.school_public_url_directory_aliases a where a.directory_id=p_directory_id))))
$$;
revoke all on function public.schools_resolve_url_public_v1(text,uuid,uuid) from public;
grant execute on function public.schools_resolve_url_public_v1(text,uuid,uuid) to anon,authenticated;

create function public.schools_search_urls_public_v1(p_query text default null,p_limit integer default 100)
returns table(slug text,source_kind text,source_id uuid,school_name text,county text,sub_county text,school_level text,ownership_type text,knec_code text,is_verified boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.* from public.school_url_public_rows() r
 where p_query is null or btrim(p_query)='' or r.school_name ilike '%'||btrim(p_query)||'%' or exists(
 select 1 from public.school_public_url_directory_aliases a join public.schools_directory d on d.id=a.directory_id where a.slug=r.slug and d.name ilike '%'||btrim(p_query)||'%')
 order by case when lower(r.school_name)=lower(btrim(p_query)) then 0 else 1 end,r.school_name,r.slug
 limit least(greatest(coalesce(p_limit,100),1),200)
$$;
revoke all on function public.schools_search_urls_public_v1(text,integer) from public;
grant execute on function public.schools_search_urls_public_v1(text,integer) to anon,authenticated;
