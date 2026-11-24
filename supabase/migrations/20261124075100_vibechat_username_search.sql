-- Scoped username suggestions; exact request/accept authorization is unchanged.
begin;
create or replace function public.vibechat_search_handles(p_query text)
returns table(handle text, display_name text, account_role text, avatar_url text)
language plpgsql stable security definer set search_path='' as $search$
declare
  v_user uuid := auth.uid();
  v_query text := regexp_replace(lower(trim(coalesce(p_query,''))), '^@', '');
begin
  if v_user is null then raise exception 'Sign-in required' using errcode='28000'; end if;
  if v_query !~ '^[a-z0-9][a-z0-9.]{2,30}$' then return; end if;
  if not exists(select 1 from public.profiles actor where actor.id=v_user
      and actor.role in ('teacher','parent','admin')
      and actor.account_status::text='active' and not coalesce(actor.is_anonymized,false))
  then return; end if;
  return query
  select p.vc_id::text, p.full_name::text, p.role::text,
    case when exists (
      select 1 from public.school_members mine
      join public.school_members theirs on theirs.school_id=mine.school_id
      where mine.profile_id=v_user and theirs.profile_id=p.id
    ) then p.avatar_url::text
    else (select pub.avatar_url::text from public.vibetutor_public_tutors pub
          where pub.profile_id=p.id limit 1) end
  from public.profiles p
  where (lower(p.vc_id) like '@' || v_query || '%'
         or lower(p.vc_id) like v_query || '%')
    and p.role in ('teacher','admin')
    and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
    and p.vc_id ~ '^@[a-zA-Z0-9][a-zA-Z0-9.]{2,30}$'
    and private.vibechat_contact_allowed(v_user,p.id)
  order by (lower(p.vc_id)='@'||v_query) desc, lower(p.vc_id)
  limit 8;
end;
$search$;
revoke all on function public.vibechat_search_handles(text) from public,anon,authenticated;
grant execute on function public.vibechat_search_handles(text) to authenticated;
-- Existing authorized conversation peers also support username filtering.
create or replace function public.vibechat_my_chat_peers()
returns jsonb language sql stable security definer set search_path = '' as $vcchatpeers$
  select coalesce(jsonb_agg(jsonb_build_object(
    'thread_id', t.id, 'name', peer.full_name, 'avatar_url', peer.avatar_url, 'handle', peer.vc_id
  )),'[]'::jsonb)
  from public.vc_participants mine
  join public.vc_threads t on t.id = mine.thread_id and t.type='direct'
  join public.vc_participants other on other.thread_id = t.id
    and other.profile_id <> mine.profile_id and other.left_at is null
  join public.profiles peer on peer.id = other.profile_id
  where auth.uid() is not null
    and mine.profile_id = auth.uid() and mine.left_at is null
    and private.vc_user_is_thread_participant(t.id)
    and peer.account_status::text='active'
    and not coalesce(peer.is_anonymized,false)
$vcchatpeers$;
revoke all on function public.vibechat_my_chat_peers() from public, anon, authenticated;
grant execute on function public.vibechat_my_chat_peers() to authenticated;

-- In tuition, the existing accepted-invitation RPC is the authority.
-- A learner profile is returned only to its accepted tutor, or vice versa.
create or replace function public.vibechat_my_tuition_peers()
returns jsonb language sql stable security definer set search_path = '' as $vctuitionpeers$
  select coalesce(jsonb_agg(jsonb_build_object(
    'invitation_id', i.id, 'name', peer.full_name, 'avatar_url', peer.avatar_url, 'handle', peer.vc_id
  )),'[]'::jsonb)
  from public.vibetutor_student_invitations i
  join lateral public.vibetutor_private_access(i.id) access on true
  join public.profiles peer on peer.id = case
    when access.tutor_id = auth.uid() then access.student_profile_id
    else access.tutor_id end
  where auth.uid() is not null and i.status = 'accepted'
    and peer.account_status::text='active'
    and not coalesce(peer.is_anonymized,false)
$vctuitionpeers$;
revoke all on function public.vibechat_my_tuition_peers() from public, anon, authenticated;
grant execute on function public.vibechat_my_tuition_peers() to authenticated;


commit;
