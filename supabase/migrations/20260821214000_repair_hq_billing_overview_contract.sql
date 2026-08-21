-- Repair the owner billing read model without enabling payment initiation.
-- The previous production definition ordered the projected row by x.created_at
-- without including created_at in x, and returned a metric key that disagreed
-- with the HQ client contract.

create or replace function public.hq_billing_overview(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(), false) then
    raise exception 'owner_authorization_required';
  end if;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'active', (select count(*) from public.billing_subscriptions where status = 'active'),
      'trialing', (select count(*) from public.billing_subscriptions where status = 'trialing'),
      'past_due', (select count(*) from public.billing_subscriptions where status = 'past_due'),
      'cancelled', (select count(*) from public.billing_subscriptions where status = 'cancelled'),
      'revenue_30d', (
        select coalesce(sum(amount), 0)
        from public.billing_subscription_events
        where occurred_at >= now() - interval '30 days'
          and event_type in (
            'payment_succeeded',
            'subscription_started',
            'renewal'
          )
      )
    ),
    'subscriptions', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          b.id,
          b.profile_id,
          p.full_name,
          p.role,
          b.plan_key,
          b.status,
          b.currency,
          b.amount,
          b.billing_interval,
          b.current_period_end,
          b.source,
          b.created_at
        from public.billing_subscriptions b
        left join public.profiles p on p.id = b.profile_id
        order by b.created_at desc
        limit greatest(1, least(coalesce(p_limit, 100), 500))
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.hq_billing_overview(integer) from public, anon;
grant execute on function public.hq_billing_overview(integer) to authenticated;

comment on function public.hq_billing_overview(integer) is
'Owner-only billing overview. Read-only and does not activate or initiate payments.';
