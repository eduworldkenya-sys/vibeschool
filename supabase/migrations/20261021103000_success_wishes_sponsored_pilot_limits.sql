begin;

-- HQ-only sponsored TEXT pilot. The school must opt in first. This does not
-- authorise paid messages, M-Pesa initiation, audio/video or a public launch.
alter table public.success_wishes_schools
  add column sponsored_text_until timestamptz,
  add column sponsored_text_max_daily integer not null default 20
    check(sponsored_text_max_daily between 1 and 50);

-- The authenticated founder may approve/stop sponsorship. An HQ viewer,
-- support agent or school administrator cannot grant free wishes.
create function public.success_wishes_set_sponsored_pilot(
  p_school_id uuid,p_enabled boolean,p_days integer default 7,
  p_daily_limit integer default 20
) returns jsonb language plpgsql security definer set search_path='' as $sw$
declare v_school public.success_wishes_schools%rowtype; v_until timestamptz;
begin
  if auth.uid() is null or p_school_id is null or p_enabled is null
    or not public.is_platform_owner()
    or not exists(select 1 from public.profiles p where p.id=auth.uid()
      and p.account_status::text='active' and not p.is_anonymized)
    then raise exception 'owner_authorization_required' using errcode='42501'; end if;
  if p_enabled and (p_days is null or p_days not between 1 and 14
      or p_daily_limit is null or p_daily_limit not between 1 and 50)
    then raise exception 'invalid_sponsor_budget' using errcode='23514'; end if;
  select * into v_school from public.success_wishes_schools
    where school_id=p_school_id for update;
  if not found then raise exception 'school_not_participating' using errcode='23514'; end if;
  if p_enabled and (not v_school.enabled or v_school.expires_at<=now()
    or not public.is_operational_school(p_school_id))
    then raise exception 'school_consent_required' using errcode='23514'; end if;
  if p_enabled then
    v_until:=least(v_school.expires_at,now()+make_interval(days=>p_days));
    update public.success_wishes_schools
      set sponsored_text=true,sponsored_text_until=v_until,
          sponsored_text_max_daily=p_daily_limit
      where school_id=p_school_id;
  else
    update public.success_wishes_schools
      set sponsored_text=false,sponsored_text_until=null
      where school_id=p_school_id;
    v_until:=null;
  end if;
  insert into public.success_wishes_audit(school_id,actor_id,event)
    values(p_school_id,auth.uid(),
      case when p_enabled then 'sponsored_text_pilot_enabled' else 'sponsored_text_pilot_disabled' end);
  return jsonb_build_object('enabled',p_enabled,'schoolId',p_school_id,
    'sponsoredUntil',v_until,'dailyLimit',
    case when p_enabled then p_daily_limit else null end);
end $sw$;
revoke all on function public.success_wishes_set_sponsored_pilot(uuid,boolean,integer,integer)
  from public,anon;
grant execute on function public.success_wishes_set_sponsored_pilot(uuid,boolean,integer,integer)
  to authenticated;

-- Even a trusted server INSERT cannot accidentally send more sponsored text
-- than the founder-approved per-school Nairobi calendar-day limit. Locking
-- by school prevents concurrent requests bypassing the aggregate check.
create function public.success_wishes_enforce_sponsored_quota()
returns trigger language plpgsql security invoker set search_path='' as $sw$
declare v_school uuid; v_setting public.success_wishes_schools%rowtype;
  v_day timestamptz; v_count integer;
begin
  if new.payment_status<>'sponsored' then return new; end if;
  if new.format<>'text' then
    raise exception 'only_text_can_be_sponsored' using errcode='23514'; end if;
  if TG_OP='UPDATE' then
    if old.payment_status='sponsored'
      and old.inbox_id=new.inbox_id and old.format=new.format then return new; end if;
  end if;
  select i.school_id into v_school from public.success_wishes_inboxes i
    where i.id=new.inbox_id;
  if v_school is null then
    raise exception 'invalid_recipient' using errcode='23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_school::text,31221));
  select * into v_setting from public.success_wishes_schools
    where school_id=v_school;
  if not found or not v_setting.enabled or not v_setting.sponsored_text
    or v_setting.expires_at<=now()
    or coalesce(v_setting.sponsored_text_until,'-infinity'::timestamptz)<=now()
    then raise exception 'sponsored_pilot_not_open' using errcode='23514'; end if;
  v_day:=date_trunc('day',now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi';
  select count(*) into v_count from public.success_wishes_messages m
    join public.success_wishes_inboxes i on i.id=m.inbox_id
    where i.school_id=v_school and m.payment_status='sponsored'
      and m.created_at>=v_day and m.created_at<v_day+interval '1 day';
  if v_count>=v_setting.sponsored_text_max_daily
    then raise exception 'sponsored_daily_limit_reached' using errcode='23514'; end if;
  return new;
end $sw$;
revoke all on function public.success_wishes_enforce_sponsored_quota()
  from public,anon,authenticated;
create trigger success_wishes_sponsored_quota_guard
before insert or update of payment_status,inbox_id,format
on public.success_wishes_messages
for each row execute function public.success_wishes_enforce_sponsored_quota();


-- A deliberately minimal founder-only directory: no student names, message
-- bodies, media metadata or candidate identifiers.
create function public.success_wishes_owner_schools()
returns table (
  school_id uuid, school_name text, participates boolean,
  campaign_expires_at timestamptz, sponsored boolean,
  sponsored_until timestamptz, daily_limit integer
) language plpgsql security definer set search_path='' as $sw$
begin
  if auth.uid() is null or not public.is_platform_owner()
    then raise exception 'owner_authorization_required' using errcode='42501'; end if;
  return query
    select w.school_id,s.name,w.enabled and w.expires_at>now(),
      w.expires_at,w.sponsored_text,w.sponsored_text_until,w.sponsored_text_max_daily
    from public.success_wishes_schools w
      join public.schools s on s.id=w.school_id
    where s.deleted_at is null and public.is_operational_school(s.id)
    order by s.name limit 100;
end $sw$;
revoke all on function public.success_wishes_owner_schools() from public,anon;
grant execute on function public.success_wishes_owner_schools() to authenticated;

commit;
