-- One durable upload reservation per paid, verified-sender media wish.
-- No public storage policy is added. Feature flags and all providers remain OFF.
begin;
-- access: service-only public.success_wishes_media_uploads
-- authorization-test: public.success_wishes_media_uploads
create table public.success_wishes_media_uploads(
  message_id uuid primary key references public.success_wishes_messages(id) on delete cascade,
  sender_id uuid not null references public.success_wishes_senders(id),
  idempotency_key text not null unique check(idempotency_key ~ '^[0-9a-f]{64}$'),
  kind text not null check(kind in ('voice','video')),
  provider text not null check(provider in ('supabase-private-voice','cloudflare-stream')),
  content_type text not null,
  bytes_declared bigint not null check(bytes_declared between 1 and 52428800),
  asset_id text unique,
  state text not null default 'reserving' check(state in('reserving','issued','processing','ready','cleanup_required','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  upload_expires_at timestamptz not null default now()+interval '15 minutes',
  check((kind='voice' and provider='supabase-private-voice'
      and content_type in('audio/webm','audio/mp4','audio/mpeg','audio/ogg')
      and bytes_declared<=26214400)
    or(kind='video' and provider='cloudflare-stream'
      and content_type in('video/mp4','video/webm','video/quicktime'))),
  check(asset_id is null or length(asset_id) between 8 and 255)
);
create index success_wishes_media_upload_age_idx
  on public.success_wishes_media_uploads(state,created_at);
alter table public.success_wishes_media_uploads enable row level security;
revoke all on public.success_wishes_media_uploads from public,anon,authenticated;
grant select,insert,update,delete on public.success_wishes_media_uploads to service_role;

-- The trigger is authoritative even if an application accidentally skips a
-- query. The service role never confers payment, sender identity or school
-- membership by writing this reservation.
create function public.success_wishes_guard_media_reservation()
returns trigger language plpgsql security invoker set search_path='' as $sw$
declare
  v_school uuid;
  v_limit bigint;
  v_count integer;
begin
  select i.school_id,w.max_media_bytes into v_school,v_limit
  from public.success_wishes_messages m
    join public.success_wishes_inboxes i on i.id=m.inbox_id
    join public.success_wishes_schools w on w.school_id=i.school_id
    join public.schools s on s.id=w.school_id
  where m.id=new.message_id and m.sender_id=new.sender_id
    and m.format=new.kind and m.media_provider=new.provider
    and m.media_status='pending' and m.payment_status='paid'
    and m.state='request' and m.expires_at>now()
    and w.enabled and w.expires_at>now()
    and s.deleted_at is null and s.status in('active','pending')
    and i.expires_at>now()
    and not exists(select 1 from public.success_wishes_blocked_senders b
      where b.inbox_id=i.id and b.sender_id=new.sender_id)
    and exists(select 1 from public.student_classes sc
      join public.students st on st.id=sc.student_id and st.deleted_at is null
      join public.classes c on c.id=sc.class_id and c.school_id=sc.school_id
      where sc.student_id=i.student_id and sc.school_id=i.school_id
        and sc.is_current and sc.left_at is null)
  for update of m;
  if v_school is null then raise exception 'paid_media_wish_not_available' using errcode='23514'; end if;
  if new.bytes_declared>v_limit then raise exception 'school_media_limit_exceeded' using errcode='23514'; end if;
  -- Per-school concurrency and daily quota cannot be bypassed by racing requests.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('success-wishes-media:'||v_school::text,21441));
  select count(*) into v_count from public.success_wishes_media_uploads u
    join public.success_wishes_messages m on m.id=u.message_id
    join public.success_wishes_inboxes i on i.id=m.inbox_id
    where i.school_id=v_school and u.created_at>now()-interval '1 day'
      and u.state<>'deleted';
  if v_count>=200 then raise exception 'daily_school_media_limit' using errcode='23514'; end if;
  return new;
end $sw$;
revoke all on function public.success_wishes_guard_media_reservation()
  from public,anon,authenticated;
create trigger success_wishes_media_reservation_guard
before insert on public.success_wishes_media_uploads
for each row execute function public.success_wishes_guard_media_reservation();
commit;
