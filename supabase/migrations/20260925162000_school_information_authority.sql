-- Canonical school events authority. School Hub is a consumer, never the owner.
-- access: targeted school-community read/admin-write public.school_events
-- authorization-test: school events are school-scoped, audience-scoped, and admin-write.

create table if not exists public.school_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 180),
  description text,
  event_type text not null default 'event' check (event_type in ('event','meeting','activity','ceremony','trip','deadline','exam_event')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'draft' check (status in ('draft','published','cancelled','archived')),
  audience_type text not null default 'all_staff' check (audience_type in ('everyone','all_staff','all_teachers','all_students','all_parents','class','profile')),
  audience_id uuid,
  requires_ack boolean not null default false,
  suppress_ordinary_teaching boolean not null default false,
  calendar_exception_id uuid references public.school_calendar_exceptions(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check ((audience_type in ('class','profile') and audience_id is not null) or (audience_type not in ('class','profile') and audience_id is null))
);
create index if not exists idx_school_events_school_time on public.school_events(school_id,starts_at);
create index if not exists idx_school_events_audience on public.school_events(school_id,audience_type,audience_id,status);
alter table public.school_events enable row level security;
revoke all on table public.school_events from public, anon, authenticated;
grant select, insert, update, delete on table public.school_events to authenticated;
grant all on table public.school_events to service_role;

create or replace function public.can_read_school_event(p_event public.school_events)
returns boolean language sql stable security definer set search_path=public as $$
  select
    public.is_active_school_member(p_event.school_id)
    and p_event.status='published'
    and (
      p_event.audience_type in ('everyone','all_staff')
      or (p_event.audience_type='all_teachers' and exists(
        select 1 from public.school_members sm where sm.school_id=p_event.school_id and sm.profile_id=auth.uid() and sm.role::text='teacher'
      ))
      or (p_event.audience_type='profile' and p_event.audience_id=auth.uid())
      or (p_event.audience_type='class' and exists(
        select 1 from public.teacher_classes tc where tc.school_id=p_event.school_id and tc.teacher_id=auth.uid() and tc.class_id=p_event.audience_id
      ))
    );
$$;
revoke all on function public.can_read_school_event(public.school_events) from public, anon;
grant execute on function public.can_read_school_event(public.school_events) to authenticated, service_role;

create policy school_events_targeted_read on public.school_events for select to authenticated
using (public.can_read_school_event(school_events) or public.is_school_admin(school_id));
create policy school_events_admin_write on public.school_events for all to authenticated
using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create or replace function public.admin_publish_school_event(p_event_id uuid)
returns public.school_events language plpgsql security definer set search_path=public as $$
declare v public.school_events; v_exception uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;
  select * into v from public.school_events where id=p_event_id for update;
  if v.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if not public.is_school_admin(v.school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED' using errcode='42501'; end if;
  if v.status not in ('draft','published') then raise exception 'EVENT_NOT_PUBLISHABLE'; end if;
  if v.audience_type='class' and not exists(select 1 from public.classes c where c.id=v.audience_id and c.school_id=v.school_id) then
    raise exception 'EVENT_CLASS_OUTSIDE_SCHOOL';
  end if;
  if v.audience_type='profile' and not public.is_school_community_profile(v.school_id,v.audience_id) then
    raise exception 'EVENT_PROFILE_OUTSIDE_SCHOOL';
  end if;
  if v.suppress_ordinary_teaching then
    insert into public.school_calendar_exceptions(school_id,exception_date,kind,label,suppress_ordinary_teaching,created_by)
    values(v.school_id,(v.starts_at at time zone 'Africa/Nairobi')::date,'event',v.title,true,auth.uid())
    on conflict(school_id,exception_date,kind) do update set label=excluded.label,suppress_ordinary_teaching=true
    returning id into v_exception;
  end if;
  update public.school_events set status='published',published_by=auth.uid(),published_at=coalesce(published_at,now()),
    calendar_exception_id=coalesce(v_exception,calendar_exception_id),updated_at=now()
  where id=v.id returning * into v;
  return v;
end $$;
revoke all on function public.admin_publish_school_event(uuid) from public, anon;
grant execute on function public.admin_publish_school_event(uuid) to authenticated, service_role;

create or replace function public.admin_cancel_school_event(p_event_id uuid)
returns public.school_events language plpgsql security definer set search_path=public as $$
declare v public.school_events;
begin
  select * into v from public.school_events where id=p_event_id for update;
  if v.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if not public.is_school_admin(v.school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED' using errcode='42501'; end if;
  if v.calendar_exception_id is not null then delete from public.school_calendar_exceptions where id=v.calendar_exception_id; end if;
  update public.school_events set status='cancelled',cancelled_at=now(),calendar_exception_id=null,updated_at=now()
  where id=v.id returning * into v;
  return v;
end $$;
revoke all on function public.admin_cancel_school_event(uuid) from public, anon;
grant execute on function public.admin_cancel_school_event(uuid) to authenticated, service_role;

create or replace function public.get_my_teacher_school_information(p_from timestamptz default null,p_until timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_school uuid; v_from timestamptz:=coalesce(p_from,now()); v_until timestamptz:=coalesce(p_until,now()+interval '14 days'); v jsonb;
begin
 if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;
 select sm.school_id into v_school from public.school_members sm
 where sm.profile_id=v_uid and coalesce(sm.status::text,'active')='active'
 order by (sm.school_id=(select p.school_id from public.profiles p where p.id=v_uid)) desc,sm.joined_at desc limit 1;
 if v_school is null then return jsonb_build_object('school_id',null,'events','[]'::jsonb,'notices','[]'::jsonb,'calendar_exceptions','[]'::jsonb); end if;
 select jsonb_build_object(
   'school_id',v_school,
   'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.starts_at) from public.school_events e where e.school_id=v_school and e.starts_at<v_until and coalesce(e.ends_at,e.starts_at)>=v_from and public.can_read_school_event(e)),'[]'::jsonb),
   'notices',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'body',c.body,'sent_at',c.sent_at,'requires_ack',c.requires_ack,'ack_deadline',c.ack_deadline,'ack_at',r.ack_at) order by c.sent_at desc)
     from public.vc_circular_recipients r join public.vc_circulars c on c.id=r.circular_id where r.profile_id=v_uid and c.school_id=v_school and c.sent_at is not null),'[]'::jsonb),
   'calendar_exceptions',coalesce((select jsonb_agg(to_jsonb(x) order by x.exception_date) from public.school_calendar_exceptions x where x.school_id=v_school and x.exception_date between (v_from at time zone 'Africa/Nairobi')::date and (v_until at time zone 'Africa/Nairobi')::date),'[]'::jsonb)
 ) into v;
 return v;
end $$;
revoke all on function public.get_my_teacher_school_information(timestamptz,timestamptz) from public, anon;
grant execute on function public.get_my_teacher_school_information(timestamptz,timestamptz) to authenticated, service_role;
