begin;

-- HQ scheduled jobs run as the database postgres role without a Supabase JWT.
-- Permit only an internal postgres session with no authenticated identity.
create or replace function public.hq_assert_owner()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_headers json;
  v_ua text;
begin
  if v_uid is null and session_user = 'postgres' then
    if not exists (
      select 1
      from public.hq_access_log l
      where l.profile_id is null
        and l.outcome = 'granted'
        and l.attempted_email = 'system:postgres'
        and l.created_at > now() - interval '5 minutes'
    ) then
      begin
        v_headers := nullif(current_setting('request.headers', true), '')::json;
      exception when others then
        v_headers := null;
      end;
      v_ua := case when v_headers is null then 'pg_cron' else coalesce(v_headers->>'user-agent','pg_cron') end;
      insert into public.hq_access_log(
        attempted_email, profile_id, outcome, user_agent, created_at
      ) values (
        'system:postgres', null, 'granted', v_ua, now()
      );
    end if;
    return;
  end if;

  if not coalesce(public.is_platform_owner(), false) then
    raise exception 'HQ access denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.hq_access_log l
    where l.profile_id = v_uid
      and l.outcome = 'granted'
      and l.created_at > now() - interval '5 minutes'
  ) then
    select u.email into v_email from auth.users u where u.id = v_uid;
    begin
      v_headers := nullif(current_setting('request.headers', true), '')::json;
    exception when others then
      v_headers := null;
    end;
    v_ua := case when v_headers is null then null else v_headers->>'user-agent' end;
    insert into public.hq_access_log(
      attempted_email, profile_id, outcome, user_agent, created_at
    ) values (
      v_email, v_uid, 'granted', v_ua, now()
    );
  end if;
end;
$function$;

alter function public.hq_assert_owner() set search_path = public;

commit;
