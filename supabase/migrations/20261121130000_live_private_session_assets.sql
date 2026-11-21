-- Private VibeSchool Live PDFs/photos. No public bucket or blanket authenticated read.
-- Original file entitlement is checked against the canonical room/membership every read,
-- including an ended class; unshared teacher drafts are invisible to learners.
-- authorization-test: public.live_classroom_assets scripts/test-live-class-assets.mjs (teacher, joined learner, outsider, revocation, ended room)
begin;

create or replace function public.live_asset_room_access(p_session uuid,p_teacher_only boolean default false)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from vibe_live.sessions s
    where s.id=p_session
      and vibe_live.host_allowed(s.teacher_id,s.mode,s.class_id,s.school_id,s.group_id)
      and (
        s.teacher_id=(select auth.uid())
        or (not p_teacher_only and exists (
          select 1 from public.students st
          join vibe_live.participants p on p.student_id=st.id and p.session_id=s.id
          where st.profile_id=(select auth.uid()) and st.deleted_at is null
            and vibe_live.can_join(st.id,s.teacher_id,s.mode,s.class_id,s.school_id,s.group_id)
        ))
      )
  );
$$;
revoke all on function public.live_asset_room_access(uuid,boolean) from public,anon;
grant execute on function public.live_asset_room_access(uuid,boolean) to authenticated;

-- The status test is kept inside a narrowly scoped, auth-aware function;
-- client RLS does not receive SELECT on the private Live room table.
create or replace function public.live_asset_upload_allowed(p_session uuid)
returns boolean language sql stable security definer set search_path=''
as $
  select public.live_asset_room_access(p_session,true) and exists(
    select 1 from vibe_live.sessions s where s.id=p_session and s.status in ('active','paused')
  );
$;
revoke all on function public.live_asset_upload_allowed(uuid) from public,anon;
grant execute on function public.live_asset_upload_allowed(uuid) to authenticated;

create table if not exists public.live_classroom_assets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references vibe_live.sessions(id) on delete cascade,
  uploader_id uuid not null default auth.uid(),
  title text not null check(length(btrim(title)) between 1 and 120),
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  byte_size bigint not null check(byte_size between 1 and 8388608),
  object_path text generated always as (
    session_id::text || '/' || id::text ||
    case mime_type when 'application/pdf' then '.pdf'
      when 'image/jpeg' then '.jpg' when 'image/png' then '.png'
      when 'image/webp' then '.webp' else '.invalid' end
  ) stored,
  shared_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists live_classroom_assets_session_idx on public.live_classroom_assets(session_id,created_at);
alter table public.live_classroom_assets enable row level security;
revoke all on public.live_classroom_assets from public,anon,authenticated;
grant select,insert,delete on public.live_classroom_assets to authenticated;
grant update(shared_at) on public.live_classroom_assets to authenticated;

create policy live_assets_authorized_read on public.live_classroom_assets
  for select to authenticated
  using (public.live_asset_room_access(session_id,false)
    and (shared_at is not null or uploader_id=(select auth.uid())));
create policy live_assets_teacher_insert on public.live_classroom_assets
  for insert to authenticated
  with check (uploader_id=(select auth.uid())
    and public.live_asset_upload_allowed(session_id));
create policy live_assets_teacher_update on public.live_classroom_assets
  for update to authenticated
  using (uploader_id=(select auth.uid()) and public.live_asset_room_access(session_id,true))
  with check (uploader_id=(select auth.uid()) and public.live_asset_room_access(session_id,true));
create policy live_assets_teacher_delete_draft on public.live_classroom_assets
  for delete to authenticated
  using (uploader_id=(select auth.uid()) and shared_at is null
    and public.live_asset_room_access(session_id,true));

create or replace function public.live_asset_share_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.id is distinct from old.id or new.session_id is distinct from old.session_id
     or new.uploader_id is distinct from old.uploader_id
     or new.title is distinct from old.title or new.mime_type is distinct from old.mime_type
     or new.byte_size is distinct from old.byte_size then
    raise exception 'live_asset_immutable' using errcode='42501';
  end if;
  if old.shared_at is null and new.shared_at is not null then
    if not exists(select 1 from vibe_live.sessions s where s.id=old.session_id and s.status in ('active','paused'))
       or not exists(select 1 from storage.objects o where o.bucket_id='vibe-live-private' and o.name=old.object_path) then
       raise exception 'live_asset_unavailable' using errcode='42501';
    end if;
    new.shared_at=now();
  elsif old.shared_at is not null and new.shared_at is not null then
    new.shared_at=old.shared_at;
  end if;
  return new;
end;
$$;
revoke all on function public.live_asset_share_guard() from public,anon,authenticated;
create trigger live_assets_sharing_check before update on public.live_classroom_assets
  for each row execute function public.live_asset_share_guard();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('vibe-live-private','vibe-live-private',false,8388608,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public=false,file_size_limit=8388608,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp']::text[];

create policy live_file_teacher_upload on storage.objects
  for insert to authenticated
  with check(bucket_id='vibe-live-private' and exists (
    select 1 from public.live_classroom_assets a
    where a.object_path=name and a.uploader_id=(select auth.uid())
      and a.shared_at is null and public.live_asset_upload_allowed(a.session_id)
  ));
create policy live_file_authorized_read on storage.objects
  for select to authenticated
  using(bucket_id='vibe-live-private' and exists (
    select 1 from public.live_classroom_assets a where a.object_path=name
  ));
create policy live_file_delete_unshared on storage.objects
  for delete to authenticated
  using(bucket_id='vibe-live-private' and exists (
    select 1 from public.live_classroom_assets a
    where a.object_path=name and a.shared_at is null
      and a.uploader_id=(select auth.uid()) and public.live_asset_room_access(a.session_id,true)
  ));

commit;
