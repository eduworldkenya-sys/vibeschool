-- Additive repair after the original search migration. Never claim an account role.
begin;
-- access: service-only private.vibechat_discovery_preferences
-- authorization-test: scripts/test-vibechat-identity-repair.mjs
create table if not exists private.vibechat_discovery_preferences(
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  open_chat boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table private.vibechat_discovery_preferences enable row level security;
revoke all on private.vibechat_discovery_preferences from public,anon,authenticated;

-- Unknown age cannot enable unscoped messaging. Existing school/tuition
-- relationships retain their separate authority. An adult learner is still
-- excluded from stranger discovery because this is an education platform.
create or replace function private.vibechat_adult_discovery(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $adult$
  select exists(select 1 from public.profiles p where p.id=p_id
    and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
    and p.date_of_birth <= current_date - interval '18 years'
    and p.role is distinct from 'student'
    and not exists(select 1 from public.students s where s.profile_id=p.id and s.deleted_at is null));
$adult$;
revoke all on function private.vibechat_adult_discovery(uuid) from public,anon,authenticated;

create or replace function public.vibechat_my_discovery()
returns jsonb language sql stable security definer set search_path='' as $self$
  select jsonb_build_object(
    'eligible',private.vibechat_adult_discovery(auth.uid()),
    'enabled',private.vibechat_adult_discovery(auth.uid()) and coalesce(
      (select d.open_chat from private.vibechat_discovery_preferences d where d.profile_id=auth.uid()),false),
    'username',coalesce(
      (select '@'||i.username from public.vs_identities i where i.auth_user_id=auth.uid() and i.username is not null),
      (select '@'||g.username from public.global_public_profiles g where g.profile_id=auth.uid() and g.username is not null),
      (select p.vc_id from public.profiles p where p.id=auth.uid())),
    'role_missing',exists(select 1 from public.profiles p where p.id=auth.uid() and p.role is null)
  );
$self$;
revoke all on function public.vibechat_my_discovery() from public,anon,authenticated;
grant execute on function public.vibechat_my_discovery() to authenticated;

create or replace function public.vibechat_set_discovery(p_enabled boolean)
returns boolean language plpgsql volatile security definer set search_path='' as $set$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if coalesce(p_enabled,false) and not private.vibechat_adult_discovery(v_user) then
    raise exception 'Adult account eligibility required' using errcode='42501'; end if;
  insert into private.vibechat_discovery_preferences(profile_id,open_chat)
    values(v_user,coalesce(p_enabled,false))
    on conflict(profile_id) do update set open_chat=excluded.open_chat,updated_at=now();
  return coalesce(p_enabled,false);
end;
$set$;
revoke all on function public.vibechat_set_discovery(boolean) from public,anon,authenticated;
grant execute on function public.vibechat_set_discovery(boolean) to authenticated;

create or replace function private.vibechat_direct_allowed(p_sender uuid,p_target uuid)
returns boolean language sql stable security definer set search_path='' as $direct$
  select p_sender<>p_target and private.vibechat_adult_discovery(p_sender)
    and private.vibechat_adult_discovery(p_target)
    and not private.vibechat_pair_blocked(p_sender,p_target)
    and exists(select 1 from private.vibechat_discovery_preferences d where d.profile_id=p_target and d.open_chat);
$direct$;
revoke all on function private.vibechat_direct_allowed(uuid,uuid) from public,anon,authenticated;

-- A canonical username is searchable without requiring a legacy VibeChat ID.
-- Existing scoped contacts still use the previous request/admission contract.
create or replace function public.vibechat_search_handles(p_query text)
returns table(handle text,display_name text,account_role text,avatar_url text,username text)
language plpgsql stable security definer set search_path='' as $search$
declare v_user uuid:=auth.uid();
  q text:=regexp_replace(lower(trim(coalesce(p_query,''))),'^@','');
begin
  if v_user is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if q !~ '^[a-z0-9][a-z0-9._]{2,30}$' then return; end if;
  if not exists(select 1 from public.profiles a where a.id=v_user and a.account_status::text='active' and not coalesce(a.is_anonymized,false)) then return; end if;
  if exists(select 1 from public.students s where s.profile_id=v_user and s.deleted_at is null) then return; end if;
  if exists(select 1 from public.profiles a where a.id=v_user and a.date_of_birth>current_date-interval '18 years') then return; end if;
  return query
  with candidates as (
    select p.id,p.vc_id,p.full_name,p.role,p.avatar_url as photo,
      coalesce(i.username,g.username) as canonical,
      g.display_name as public_name,g.avatar_url as public_photo,g.username as public_username,
      private.vibechat_direct_allowed(v_user,p.id) as direct_ok,
      (p.vc_id is not null and private.vibechat_contact_allowed(v_user,p.id)) as scoped_ok
    from public.profiles p
    left join public.vs_identities i on i.auth_user_id=p.id and i.kind='person'
    left join public.global_public_profiles g on g.profile_id=p.id and g.is_public
    where p.id<>v_user and p.account_status::text='active'
      and not coalesce(p.is_anonymized,false) and p.role is distinct from 'student'
      and (p.date_of_birth is null or p.date_of_birth <= current_date-interval '18 years')
      and not exists(select 1 from public.students s where s.profile_id=p.id and s.deleted_at is null)
      and (left(lower(p.vc_id),length(q)+1)='@'||q
        or left(lower(coalesce(i.username,g.username)),length(q))=q)
      and not private.vibechat_pair_blocked(v_user,p.id)
  )
  select case when c.direct_ok and c.canonical is not null then '@'||c.canonical else c.vc_id end::text,
    coalesce(nullif(c.public_name,''),nullif(c.full_name,''),'VibeSchool user')::text,
    coalesce(c.role::text,'member'),
    case when c.direct_ok then c.public_photo::text
      when exists(select 1 from public.school_members a join public.school_members b on a.school_id=b.school_id where a.profile_id=v_user and b.profile_id=c.id) then c.photo::text
      else (select t.avatar_url::text from public.vibetutor_public_tutors t where t.profile_id=c.id limit 1) end,
    case when c.direct_ok then c.canonical else c.public_username end::text
  from candidates c
  where (c.direct_ok or c.scoped_ok) and (c.vc_id is not null or c.canonical is not null)
    and (c.direct_ok or left(lower(c.vc_id),length(q)+1)='@'||q or exists(select 1 from public.global_public_profiles g where g.profile_id=c.id and g.is_public and g.username=c.canonical))
  order by (lower(c.vc_id)='@'||q or lower(c.canonical)=q) desc nulls last,coalesce(c.canonical,c.vc_id)
  limit 8;
end;
$search$;
revoke all on function public.vibechat_search_handles(text) from public,anon,authenticated;
grant execute on function public.vibechat_search_handles(text) to authenticated;

create or replace function public.vibechat_open_or_request_contact(p_handle text)
returns uuid language plpgsql volatile security definer set search_path='' as $open$
declare v_user uuid:=auth.uid(); v_target uuid; v_thread uuid; v_request uuid; v_legacy text;
  q text:=regexp_replace(lower(trim(coalesce(p_handle,''))),'^@','');
begin
  if v_user is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if q !~ '^[a-z0-9][a-z0-9._]{2,30}$' then raise exception 'Contact unavailable' using errcode='42501'; end if;
  select p.id,p.vc_id into v_target,v_legacy from public.profiles p
    left join public.vs_identities i on i.auth_user_id=p.id and i.kind='person'
    left join public.global_public_profiles g on g.profile_id=p.id and g.is_public
    where p.id<>v_user and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
      and (lower(p.vc_id)='@'||q or lower(g.username)=q or (lower(i.username)=q and private.vibechat_direct_allowed(v_user,p.id)))
    order by (lower(p.vc_id)='@'||q) desc nulls last limit 1;
  if v_target is null or private.vibechat_pair_blocked(v_user,v_target) then
    raise exception 'Contact unavailable' using errcode='42501'; end if;
  -- Serialize on pair to prevent duplicate conversations.
  perform pg_advisory_xact_lock(hashtextextended(least(v_user,v_target)::text||':'||greatest(v_user,v_target)::text,0));
  select t.id into v_thread from public.vc_threads t
    where t.type='direct' and private.vc_user_is_thread_participant(t.id)
      and private.vibechat_room_peer('vc',t.id)=v_target
    order by t.created_at desc limit 1;
  if v_thread is not null then return v_thread; end if;
  if exists(select 1 from public.vibechat_contact_requests r where r.status='declined'
      and least(r.requester_id,r.recipient_id)=least(v_user,v_target)
      and greatest(r.requester_id,r.recipient_id)=greatest(v_user,v_target)) then
    raise exception 'Contact unavailable' using errcode='42501'; end if;
  if private.vibechat_direct_allowed(v_user,v_target) then
    -- Opening a new opted-in adult chat is rate-limited; no student room is created.
    perform pg_advisory_xact_lock(hashtextextended('vibechat-open:'||v_user::text,0));
    if (select count(*) from public.vc_threads t where t.created_by=v_user and t.type='direct' and t.created_at>now()-interval '1 day')>=20 then
      raise exception 'New chat limit reached' using errcode='42501'; end if;
    insert into public.vc_threads(school_id,type,created_by,context_tag,subject)
      values(null,'direct',v_user,'general','VibeChat') returning id into v_thread;
    insert into public.vc_participants(thread_id,profile_id,school_id)
      values(v_thread,v_user,null),(v_thread,v_target,null);
    -- Reuse canonical request record so Contacts shows this connection.
    insert into public.vibechat_contact_requests(requester_id,recipient_id,status,thread_id,responded_at)
      values(v_user,v_target,'accepted',v_thread,now())
      on conflict do nothing;
    update public.vibechat_contact_requests r set status='accepted',thread_id=v_thread,responded_at=now()
      where r.status='pending' and least(r.requester_id,r.recipient_id)=least(v_user,v_target)
      and greatest(r.requester_id,r.recipient_id)=greatest(v_user,v_target);
    return v_thread;
  end if;
  if v_legacy is null or not private.vibechat_contact_allowed(v_user,v_target)
      or exists(select 1 from public.profiles p where p.id=v_user and p.date_of_birth>current_date-interval '18 years')
      or exists(select 1 from public.students s where s.profile_id=v_user and s.deleted_at is null)
      or not exists(select 1 from public.profiles p where p.id=v_user and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
      or exists(select 1 from public.profiles p where p.id=v_target and p.date_of_birth>current_date-interval '18 years')
      or exists(select 1 from public.students s where s.profile_id=v_target and s.deleted_at is null) then
    raise exception 'Contact unavailable' using errcode='42501'; end if;
  v_request:=public.vibechat_request_contact(v_legacy);
  select r.thread_id into v_thread from public.vibechat_contact_requests r where r.id=v_request and r.status='accepted' and private.vc_user_is_thread_participant(r.thread_id);
  return v_thread;
end;
$open$;
revoke all on function public.vibechat_open_or_request_contact(text) from public,anon,authenticated;
grant execute on function public.vibechat_open_or_request_contact(text) to authenticated;
notify pgrst,'reload schema';
commit;
