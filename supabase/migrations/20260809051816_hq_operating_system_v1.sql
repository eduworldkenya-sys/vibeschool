-- Recovered from the authoritative production Supabase migration ledger for L0 replay parity.
begin;

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid null,
  actor_role text null,
  school_id uuid null,
  entity_type text not null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists platform_events_occurred_at_idx on public.platform_events (occurred_at desc);
create index if not exists platform_events_event_type_idx on public.platform_events (event_type, occurred_at desc);
create index if not exists platform_events_school_idx on public.platform_events (school_id, occurred_at desc) where school_id is not null;
create index if not exists platform_events_entity_idx on public.platform_events (entity_type, entity_id) where entity_id is not null;

create table if not exists public.hq_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid null references public.platform_events(id) on delete set null,
  category text not null default 'operations',
  severity text not null default 'info' check (severity in ('info','success','warning','critical')),
  title text not null,
  body text not null default '',
  route text null,
  status text not null default 'unread' check (status in ('unread','read','resolved')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  resolved_at timestamptz null
);
create index if not exists hq_notifications_status_idx on public.hq_notifications (status, created_at desc);
create index if not exists hq_notifications_severity_idx on public.hq_notifications (severity, created_at desc);

create table if not exists public.hq_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_type text not null,
  severity text not null check (severity in ('warning','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  title text not null,
  summary text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  route text null,
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  resolved_at timestamptz null
);
create index if not exists hq_incidents_open_idx on public.hq_incidents (status, severity, detected_at desc);

alter table public.platform_events enable row level security;
alter table public.hq_notifications enable row level security;
alter table public.hq_incidents enable row level security;
revoke all on public.platform_events from anon, authenticated;
revoke all on public.hq_notifications from anon, authenticated;
revoke all on public.hq_incidents from anon, authenticated;

create or replace function public.hq_emit_event(
  p_event_type text,
  p_actor_id uuid,
  p_actor_role text,
  p_school_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_title text;
  v_body text;
  v_route text;
  v_category text := 'operations';
  v_severity text := 'info';
  v_should_notify boolean := true;
begin
  insert into public.platform_events(event_type, actor_id, actor_role, school_id, entity_type, entity_id, metadata)
  values (p_event_type, p_actor_id, p_actor_role, p_school_id, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_event_id;

  case p_event_type
    when 'user.signup' then v_category := 'growth'; v_title := 'New signup'; v_body := coalesce(p_metadata->>'role', 'User'); v_route := '/hq?view=users';
    when 'school.created' then v_category := 'growth'; v_severity := 'success'; v_title := 'New school registered'; v_body := coalesce(p_metadata->>'name', 'A school joined VibeSchool'); v_route := '/hq?view=schools';
    when 'lesson_plan.created' then v_category := 'teaching'; v_title := 'Lesson plan created'; v_body := coalesce(p_metadata->>'title', 'New lesson plan'); v_route := '/hq?view=lesson-plans';
    when 'lesson_plan.published' then v_category := 'teaching'; v_severity := 'success'; v_title := 'Lesson plan published'; v_body := coalesce(p_metadata->>'title', 'Lesson plan published'); v_route := '/hq?view=lesson-plans';
    when 'lesson_plan.completed' then v_category := 'teaching'; v_should_notify := false;
    when 'homework.created' then v_category := 'teaching'; v_title := 'Homework assigned'; v_body := coalesce(p_metadata->>'title', 'New homework'); v_route := '/hq?view=homework';
    when 'homework.submitted' then v_category := 'learning'; v_should_notify := false;
    when 'publication.created' then v_category := 'content'; v_title := 'Publication draft created'; v_body := coalesce(p_metadata->>'title', 'New publication'); v_route := '/hq?view=content';
    when 'publication.published' then v_category := 'content'; v_severity := 'success'; v_title := 'Publication went live'; v_body := coalesce(p_metadata->>'title', 'Publication published'); v_route := '/hq?view=content';
    else v_should_notify := false;
  end case;
  if v_should_notify then
    insert into public.hq_notifications(event_id, category, severity, title, body, route, metadata)
    values (v_event_id, v_category, v_severity, v_title, coalesce(v_body,''), v_route, coalesce(p_metadata,'{}'::jsonb));
  end if;
  return v_event_id;
end;
$$;
revoke all on function public.hq_emit_event(text,uuid,text,uuid,text,uuid,jsonb) from public, anon, authenticated;

create or replace function public.hq_assert_owner()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_platform_owner(), false) then
    raise exception 'HQ access denied' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.hq_assert_owner() from public, anon;
grant execute on function public.hq_assert_owner() to authenticated;

commit;
