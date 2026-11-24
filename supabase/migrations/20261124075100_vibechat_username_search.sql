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
commit;
