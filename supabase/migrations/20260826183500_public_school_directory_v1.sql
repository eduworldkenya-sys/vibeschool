-- Public school directory V1: canonical search, public profiles, and governed corrections.

alter table public.school_discovery_requests
  add column if not exists target_school_id uuid references public.schools(id) on delete set null;

create index if not exists school_discovery_requests_target_school_idx
  on public.school_discovery_requests(target_school_id)
  where target_school_id is not null;

create or replace function public.schools_search_public_v1(
  p_query text default null,
  p_county text default null,
  p_sub_county text default null,
  p_school_category text default null,
  p_ownership_type text default null,
  p_gender_type text default null,
  p_accommodation_type text default null,
  p_limit integer default 50
)
returns table(
  school_id uuid,
  school_name text,
  county text,
  sub_county text,
  school_category text,
  ownership_type text,
  gender_type text,
  accommodation_type text,
  cluster text,
  knec_code text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.name::text, s.county::text, s.sub_county::text,
         s.school_category::text, s.ownership_type, s.gender_type,
         s.accommodation_type, s.cluster, s.knec_code::text
  from public.schools s
  where s.deleted_at is null
    and s.status = 'active'
    and (p_query is null or trim(p_query) = '' or lower(s.name) like '%' || lower(trim(p_query)) || '%')
    and (p_county is null or trim(p_county) = '' or lower(coalesce(s.county,'')) = lower(trim(p_county)))
    and (p_sub_county is null or trim(p_sub_county) = '' or lower(coalesce(s.sub_county,'')) = lower(trim(p_sub_county)))
    and (p_school_category is null or trim(p_school_category) = '' or lower(coalesce(s.school_category::text,'')) = lower(trim(p_school_category)))
    and (p_ownership_type is null or trim(p_ownership_type) = '' or lower(coalesce(s.ownership_type,'')) = lower(trim(p_ownership_type)))
    and (p_gender_type is null or trim(p_gender_type) = '' or lower(coalesce(s.gender_type,'')) = lower(trim(p_gender_type)))
    and (p_accommodation_type is null or trim(p_accommodation_type) = '' or lower(coalesce(s.accommodation_type,'')) = lower(trim(p_accommodation_type)))
  order by case when p_query is not null and lower(s.name)=lower(trim(p_query)) then 0 else 1 end, s.name asc
  limit least(greatest(coalesce(p_limit,50),1),100);
$$;

revoke all on function public.schools_search_public_v1(text,text,text,text,text,text,text,integer) from public;
grant execute on function public.schools_search_public_v1(text,text,text,text,text,text,text,integer) to anon, authenticated;

create or replace function public.schools_search_community_pending_v1(
  p_query text default null,
  p_county text default null,
  p_sub_county text default null,
  p_level text default null,
  p_limit integer default 25
)
returns table(
  request_id uuid,
  school_name text,
  county text,
  sub_county text,
  school_level text,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.id, r.name, r.county, r.sub_county, r.level, r.created_at
  from public.school_discovery_requests r
  where r.status='pending'
    and r.request_type='missing_or_new'
    and r.target_school_id is null
    and (p_query is null or trim(p_query)='' or lower(r.name) like '%' || lower(trim(p_query)) || '%')
    and (p_county is null or trim(p_county)='' or lower(coalesce(r.county,''))=lower(trim(p_county)))
    and (p_sub_county is null or trim(p_sub_county)='' or lower(coalesce(r.sub_county,''))=lower(trim(p_sub_county)))
    and (p_level is null or trim(p_level)='' or lower(coalesce(r.level,''))=lower(trim(p_level)))
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit,25),1),50);
$$;

revoke all on function public.schools_search_community_pending_v1(text,text,text,text,integer) from public;
grant execute on function public.schools_search_community_pending_v1(text,text,text,text,integer) to anon, authenticated;

create or replace function public.schools_get_public_profile_v1(p_school_id uuid)
returns table(
  school_id uuid,
  school_name text,
  county text,
  sub_county text,
  school_category text,
  ownership_type text,
  gender_type text,
  accommodation_type text,
  cluster text,
  knec_code text,
  pathway_slug text,
  pathway_name text,
  combination_slug text,
  combination_name text,
  verified_at timestamptz,
  source_authority text,
  source_name text,
  source_url text,
  source_reference text,
  source_observed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.name::text, s.county::text, s.sub_county::text,
         s.school_category::text, s.ownership_type, s.gender_type,
         s.accommodation_type, s.cluster, s.knec_code::text,
         p.slug, p.name, c.slug, c.display_name, o.verified_at,
         src.authority_name, src.source_name, src.source_url, src.source_reference, src.observed_at
  from public.schools s
  left join public.pathway_school_offerings o
    on o.school_id=s.id
   and o.verification_state='verified'
   and o.verified_at is not null
   and (o.effective_to is null or o.effective_to>=current_date)
  left join public.pathway_sources src
    on src.id=o.source_id and src.is_public=true and src.status='active'
  left join public.pathways p
    on p.id=o.pathway_id and src.id is not null and p.status='published' and p.verification_state='verified'
  left join public.pathway_subject_combinations c
    on c.id=o.combination_id and p.id is not null and c.status='published' and c.verification_state='verified'
  where s.id=p_school_id and s.deleted_at is null and s.status='active'
  order by p.name asc nulls last, c.display_name asc nulls last;
$$;

revoke all on function public.schools_get_public_profile_v1(uuid) from public;
grant execute on function public.schools_get_public_profile_v1(uuid) to anon, authenticated;

create or replace function public.submit_school_correction_request(
  p_school_id uuid,
  p_notes text,
  p_contact_name text default null,
  p_contact_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_school public.schools%rowtype;
  v_notes text := trim(coalesce(p_notes,''));
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if length(v_notes) < 10 then raise exception 'Correction detail is too short'; end if;

  select * into v_school
  from public.schools
  where id=p_school_id and deleted_at is null and status='active';

  if not found then raise exception 'School not found'; end if;

  select id into v_id
  from public.school_discovery_requests
  where requested_by=v_uid
    and status='pending'
    and request_type='correction'
    and target_school_id=p_school_id
  order by created_at desc
  limit 1;

  if v_id is not null then return v_id; end if;

  insert into public.school_discovery_requests(
    requested_by,name,county,sub_county,level,notes,status,request_type,target_school_id,contact_name,contact_phone
  ) values (
    v_uid,v_school.name,v_school.county,v_school.sub_county,v_school.school_category::text,v_notes,
    'pending','correction',p_school_id,nullif(trim(p_contact_name),''),nullif(trim(p_contact_phone),'')
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_school_correction_request(uuid,text,text,text) from public;
grant execute on function public.submit_school_correction_request(uuid,text,text,text) to authenticated;
