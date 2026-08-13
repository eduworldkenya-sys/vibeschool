create or replace function public.hq_security_events(p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
begin
 if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select event_type,outcome,risk_score,created_at,actor_id,metadata from public.security_audit_events order by created_at desc limit greatest(1,least(coalesce(p_limit,200),500))) x),'[]'::jsonb);
end;$$;
revoke all on function public.hq_security_events(integer) from public,anon; grant execute on function public.hq_security_events(integer) to authenticated;
