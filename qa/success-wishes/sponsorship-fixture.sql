-- Disposable fixture: simulated platform owner. This MUST NOT be applied to
-- production. Production already has its canonical is_platform_owner() authority.
create function public.is_platform_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() = '33333333-3333-4333-8333-333333333333'::uuid;
$$;
revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_platform_owner() to authenticated;
