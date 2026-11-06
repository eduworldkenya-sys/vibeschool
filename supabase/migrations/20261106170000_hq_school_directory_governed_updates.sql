-- access: owner-only public.hq_school_directory_edits
-- authorization-test: public.hq_school_directory_edits scripts/test-hq-school-directory-governance.py (anon table access and RPC updates denied)
-- HQ-only school directory management.
-- Never updates is_verified, names, registration codes, canonical IDs or URL slugs.
-- All changes require evidence notes and preserve an append-only before/after audit trail.
create table if not exists public.hq_school_directory_edits (
 id uuid primary key default gen_random_uuid(),
 directory_id uuid not null references public.schools_directory(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 before_record jsonb not null,
 after_record jsonb not null,
 evidence_note text not null check (char_length(evidence_note) between 10 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists hq_school_directory_edits_school_created_idx
 on public.hq_school_directory_edits(directory_id,created_at desc);
alter table public.hq_school_directory_edits enable row level security;
revoke all on public.hq_school_directory_edits from public,anon,authenticated;

create or replace function public.hq_school_directory_manage_search_v1(p_query text,p_limit integer default 30)
returns table(id uuid,name text,county text,sub_county text,school_level text,latitude double precision,longitude double precision,slug text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.is_platform_owner() then raise exception 'hq_owner_required' using errcode='42501'; end if;
 if length(btrim(coalesce(p_query,''))) < 2 then return; end if;
 return query
 select d.id,d.name,d.county,d.sub_county,d.type,d.latitude,d.longitude,
        coalesce(u.slug,a.slug) as slug
 from public.schools_directory d
 left join public.school_public_urls u on u.directory_id=d.id
 left join public.school_public_url_directory_aliases a on a.directory_id=d.id
 where d.name ilike '%'||btrim(p_query)||'%'
    or d.id::text = btrim(p_query)
 order by case when lower(d.name)=lower(btrim(p_query)) then 0 else 1 end,d.name,d.id
 limit least(greatest(coalesce(p_limit,30),1),50);
end $$;
revoke all on function public.hq_school_directory_manage_search_v1(text,integer) from public;
grant execute on function public.hq_school_directory_manage_search_v1(text,integer) to authenticated;

create or replace function public.hq_school_directory_apply_edits_v1(p_changes jsonb,p_evidence_note text)
returns integer language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_item jsonb;v_id uuid;v_before public.schools_directory%rowtype;v_after public.schools_directory%rowtype;
 v_count integer:=0;v_keys text[];v_value text;v_seen uuid[]:=array[]::uuid[];
begin
 if not public.is_platform_owner() then raise exception 'hq_owner_required' using errcode='42501'; end if;
 if length(btrim(coalesce(p_evidence_note,''))) not between 10 and 1000 then raise exception 'evidence_note_required'; end if;
 if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes) not between 1 and 100 then
  raise exception 'changes_must_be_array_1_to_100';
 end if;
 for v_item in select value from jsonb_array_elements(p_changes) order by value->>'id' loop
  if jsonb_typeof(v_item)<>'object' or not (v_item ? 'id') then raise exception 'invalid_change_record'; end if;
  v_id:=(v_item->>'id')::uuid;
  if v_id = any(v_seen) then raise exception 'duplicate_school_id'; end if;
  v_seen:=array_append(v_seen,v_id);
  select array_agg(key) into v_keys from jsonb_object_keys(v_item) as key
    where key not in ('id','county','sub_county','type','latitude','longitude');
  if coalesce(array_length(v_keys,1),0)>0 then raise exception 'field_not_allowed'; end if;
  if not (v_item ?| array['county','sub_county','type','latitude','longitude']) then raise exception 'empty_patch'; end if;
  if (v_item ? 'latitude') <> (v_item ? 'longitude') then raise exception 'coordinates_must_be_paired'; end if;
  select * into v_before from public.schools_directory where id=v_id for update;
  if not found then raise exception 'unknown_directory_id';end if;
  if v_item ? 'county' and (jsonb_typeof(v_item->'county')<>'string' or length(btrim(v_item->>'county')) not between 2 and 80) then raise exception 'invalid_county';end if;
  if v_item ? 'sub_county' and (jsonb_typeof(v_item->'sub_county')<>'string' or length(btrim(v_item->>'sub_county'))>100) then raise exception 'invalid_sub_county';end if;
  if v_item ? 'type' and (jsonb_typeof(v_item->'type')<>'string' or length(btrim(v_item->>'type')) not between 2 and 80) then raise exception 'invalid_school_level';end if;
  if v_item ? 'latitude' and not ((v_item->>'latitude')::double precision between -5 and 5 and (v_item->>'longitude')::double precision between 33 and 42) then raise exception 'invalid_coordinates';end if;
  update public.schools_directory set
   county=case when v_item ? 'county' then btrim(v_item->>'county') else county end,
   sub_county=case when v_item ? 'sub_county' then nullif(btrim(v_item->>'sub_county'),'') else sub_county end,
   type=case when v_item ? 'type' then btrim(v_item->>'type') else type end,
   latitude=case when v_item ? 'latitude' then (v_item->>'latitude')::double precision else latitude end,
   longitude=case when v_item ? 'longitude' then (v_item->>'longitude')::double precision else longitude end
  where id=v_id returning * into v_after;
  insert into public.hq_school_directory_edits(directory_id,actor_id,before_record,after_record,evidence_note)
   values(v_id,auth.uid(),to_jsonb(v_before),to_jsonb(v_after),btrim(p_evidence_note));
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function public.hq_school_directory_apply_edits_v1(jsonb,text) from public;
grant execute on function public.hq_school_directory_apply_edits_v1(jsonb,text) to authenticated;

-- Read-only audit history for platform owner. Do not expose direct audit-table SELECT.
create or replace function public.hq_school_directory_edit_history_v1(p_directory_id uuid,p_limit integer default 20)
returns table(created_at timestamptz, actor_id uuid, evidence_note text, before_record jsonb, after_record jsonb)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.is_platform_owner() then raise exception 'hq_owner_required' using errcode='42501'; end if;
 return query
 select h.created_at,h.actor_id,h.evidence_note,h.before_record,h.after_record
 from public.hq_school_directory_edits h
 where h.directory_id=p_directory_id
 order by h.created_at desc
 limit least(greatest(coalesce(p_limit,20),1),50);
end $$;
revoke all on function public.hq_school_directory_edit_history_v1(uuid,integer) from public;
grant execute on function public.hq_school_directory_edit_history_v1(uuid,integer) to authenticated;
