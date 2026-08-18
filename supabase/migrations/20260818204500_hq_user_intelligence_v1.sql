begin;

create or replace function public.hq_user_intelligence_overview()
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;

  return jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'new_24h', (select count(*) from auth.users where created_at >= now()-interval '24 hours'),
    'new_7d', (select count(*) from auth.users where created_at >= now()-interval '7 days'),
    'new_30d', (select count(*) from auth.users where created_at >= now()-interval '30 days'),
    'signed_in_24h', (select count(*) from auth.users where last_sign_in_at >= now()-interval '24 hours'),
    'signed_in_7d', (select count(*) from auth.users where last_sign_in_at >= now()-interval '7 days'),
    'signed_in_30d', (select count(*) from auth.users where last_sign_in_at >= now()-interval '30 days'),
    'never_signed_in', (select count(*) from auth.users where last_sign_in_at is null),
    'active_accounts', (select count(*) from public.profiles where account_status::text='active' and not coalesce(is_anonymized,false)),
    'unaffiliated_profiles', (select count(*) from public.profiles where school_id is null and not coalesce(is_anonymized,false)),
    'active_subscriptions', (select count(*) from public.billing_subscriptions where status='active'),
    'trialing_subscriptions', (select count(*) from public.billing_subscriptions where status='trialing'),
    'past_due_subscriptions', (select count(*) from public.billing_subscriptions where status='past_due')
  );
end;
$$;
revoke all on function public.hq_user_intelligence_overview() from public,anon;
grant execute on function public.hq_user_intelligence_overview() to authenticated;

create or replace function public.hq_user_directory(p_search text default null,p_role text default null,p_status text default null,p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc)
    from (
      select p.id,p.full_name,p.role,p.account_status::text account_status,p.is_anonymized,p.created_at,p.updated_at,p.school_id,p.vc_id,p.arrived_at,
        au.last_sign_in_at,
        case when au.last_sign_in_at is null then null else extract(epoch from (now()-au.last_sign_in_at))::bigint end seconds_since_sign_in,
        (select max(e.created_at) from public.security_audit_events e where e.actor_id=p.id) last_security_activity,
        (select max(h.created_at) from public.hq_user_status_events h where h.profile_id=p.id) last_status_change,
        (select count(*) from public.billing_subscriptions bs where bs.profile_id=p.id and bs.status in ('active','trialing','past_due')) active_subscription_count
      from public.profiles p
      left join auth.users au on au.id=p.id
      where (p_search is null or p.full_name ilike '%'||p_search||'%' or p.vc_id ilike '%'||p_search||'%')
        and (p_role is null or p.role=p_role)
        and (p_status is null or p.account_status::text=p_status)
      limit greatest(1,least(coalesce(p_limit,100),500))
    ) x
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.hq_user_directory(text,text,text,integer) from public,anon;
grant execute on function public.hq_user_directory(text,text,text,integer) to authenticated;

commit;
