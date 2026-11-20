-- Bounded read-only discovery over the canonical public URL projection.
-- Approximate coordinates only; no location persistence. Literal user text is never SQL.
create or replace function public.schools_discover_public_v1(
 p_query text default null,p_county text default null,p_sub_county text default null,
 p_level text default null,p_limit integer default 100,
 p_lat double precision default null,p_lng double precision default null
) returns table(slug text,source_kind text,source_id uuid,school_name text,county text,
 sub_county text,school_level text,ownership_type text,knec_code text,is_verified boolean,distance_km double precision)
language sql stable security definer set search_path=public,pg_temp as $$
 with q as (select lower(btrim(coalesce(p_query,''))) text,
  p_lat between -5 and 5 and p_lng between 33 and 42 nearby),
 rows as (
 select r.*,case when q.nearby then 12742 * asin(sqrt(least(1.0,greatest(0.0,
  power(sin(radians((coalesce(s.gps_lat,d.latitude)::double precision-p_lat)/2)),2)+
  cos(radians(p_lat))*cos(radians(coalesce(s.gps_lat,d.latitude)::double precision))*
  power(sin(radians((coalesce(s.gps_lng,d.longitude)::double precision-p_lng)/2)),2))))) end km,
 case when length(q.text)>=4 then greatest(extensions.word_similarity(q.text,lower(r.school_name)),extensions.similarity(q.text,lower(r.school_name))) else 0 end score
 from public.school_url_public_rows() r cross join q
 left join public.schools s on r.source_kind='canonical' and s.id=r.source_id and q.nearby
 left join public.schools_directory d on r.source_kind='directory' and d.id=r.source_id and q.nearby
 where (nullif(btrim(p_county),'') is null or lower(r.county)=lower(btrim(p_county)))
 and (nullif(btrim(p_sub_county),'') is null or lower(r.sub_county)=lower(btrim(p_sub_county)))
 and (nullif(btrim(p_level),'') is null or lower(r.school_level)=lower(btrim(p_level)))
 and length(q.text)<=100
 and ((p_lat is null and p_lng is null and length(q.text)>=4) or
 (q.nearby and coalesce(s.gps_lat,d.latitude) between -5 and 5 and coalesce(s.gps_lng,d.longitude) between 33 and 42
 and abs(coalesce(s.gps_lat,d.latitude)::double precision-p_lat)<=0.3 and abs(coalesce(s.gps_lng,d.longitude)::double precision-p_lng)<=0.3))
 )
 select r.slug,r.source_kind,r.source_id,r.school_name,r.county,r.sub_county,r.school_level,r.ownership_type,r.knec_code,r.is_verified,r.km
 from rows r cross join q
 where ((q.nearby and r.km<=30 and (q.text='' or strpos(lower(r.school_name),q.text)>0 or r.score>=0.55))
 or (p_lat is null and p_lng is null and r.score>=0.55))
 order by r.km nulls last, r.score desc,r.school_name,r.slug
 limit least(greatest(coalesce(p_limit,100),1),100)
$$;
revoke all on function public.schools_discover_public_v1(text,text,text,text,integer,double precision,double precision) from public;
grant execute on function public.schools_discover_public_v1(text,text,text,text,integer,double precision,double precision) to anon,authenticated;

-- Use the existing private discovery review queue, never update public records from a report.
alter table public.school_discovery_requests add column if not exists target_directory_id uuid references public.schools_directory(id) on delete set null;
create index if not exists school_discovery_requests_directory_target_idx on public.school_discovery_requests(requested_by,target_directory_id) where status='pending' and request_type='correction';

create or replace function public.submit_directory_school_correction_v1(p_slug text,p_notes text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid();v_school record;v_id uuid;v_notes text:=btrim(coalesce(p_notes,''));
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if length(v_notes)<10 or length(v_notes)>1000 then raise exception 'Invalid correction length'; end if;
 select * into v_school from public.school_url_public_rows() where slug=p_slug and source_kind='directory';
 if not found then raise exception 'School not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
 select id into v_id from public.school_discovery_requests where requested_by=v_uid and target_directory_id=v_school.source_id and request_type='correction' and status='pending' limit 1;
 if v_id is not null then return v_id; end if;
 if (select count(*) from public.school_discovery_requests where requested_by=v_uid and request_type='correction' and created_at>now()-interval '24 hours')>=10 then raise exception 'Correction limit exceeded'; end if;
 insert into public.school_discovery_requests(requested_by,name,county,sub_county,level,notes,status,request_type,target_directory_id)
 values(v_uid,v_school.school_name,v_school.county,v_school.sub_county,v_school.school_level,'School: /school/'||v_school.slug||E'\n'||v_notes,'pending','correction',v_school.source_id) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.submit_directory_school_correction_v1(text,text) from public,anon;
grant execute on function public.submit_directory_school_correction_v1(text,text) to authenticated;

-- Review closure only: actual school edits remain in the audited HQ correction tool.
create or replace function public.hq_close_school_correction_v1(p_request_id uuid,p_accepted boolean,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
 if p_accepted is null or length(btrim(coalesce(p_note,''))) not between 3 and 1000 then raise exception 'Review note required'; end if;
 update public.school_discovery_requests set status=case when p_accepted then 'matched' else 'rejected' end,
 resolved_at=now(),notes=concat_ws(E'\n',notes,'Operator: '||btrim(p_note))
 where id=p_request_id and request_type='correction' and status='pending';
 if not found then raise exception 'Pending correction not found'; end if;
end;$$;
revoke all on function public.hq_close_school_correction_v1(uuid,boolean,text) from public,anon;
grant execute on function public.hq_close_school_correction_v1(uuid,boolean,text) to authenticated;
