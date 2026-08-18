-- HQ Notifications R2 optional-source compatibility.
-- Some production-only operator tables were created before their full DDL was
-- repository-tracked. Clean rebuilds must use canonical repository truth instead
-- of inventing duplicate state stores. Production relations, when present, win.

begin;

-- Policy failures: canonical repository truth is the observed product-policy state.
-- A failed/drift state with last_error is equivalent to an actionable policy failure.
do $$
begin
  if to_regclass('public.hq_policy_failures') is null then
    execute $view$
      create view public.hq_policy_failures
      with (security_invoker = true)
      as
      select
        row_number() over (order by s.updated_at, s.id)::bigint as id,
        s.product_key,
        s.policy_key,
        s.last_error as error_message,
        s.updated_at as created_at
      from public.hq_product_policy_state s
      where s.state in ('failed','drift')
        and s.last_error is not null
    $view$;
    revoke all on public.hq_policy_failures from public, anon, authenticated;
    grant select on public.hq_policy_failures to service_role;
  end if;
end $$;

-- Approval queue: HQ work items are the canonical repository-backed approval plane.
do $$
begin
  if to_regclass('public.hq_artifact_approvals') is null then
    execute $view$
      create view public.hq_artifact_approvals
      with (security_invoker = true)
      as
      select
        w.id,
        case
          when w.status = 'waiting_approval' then 'waiting'
          else w.status
        end::text as status,
        w.created_at
      from public.hq_work_items w
      where w.approval_required = true
        and w.status not in ('resolved','cancelled')
    $view$;
    revoke all on public.hq_artifact_approvals from public, anon, authenticated;
    grant select on public.hq_artifact_approvals to service_role;
  end if;
end $$;

-- School identity review: on clean rebuilds, derive unresolved identity-review work
-- from the canonical HQ work bus. Production's dedicated review queue is preserved.
do $$
begin
  if to_regclass('public.school_identity_review_queue') is null then
    execute $view$
      create view public.school_identity_review_queue
      with (security_invoker = true)
      as
      select
        w.id,
        w.created_at,
        w.resolved_at
      from public.hq_work_items w
      where w.status not in ('resolved','cancelled')
        and (
          lower(coalesce(w.source_type,'')) like '%school%identity%'
          or lower(coalesce(w.work_type,'')) like '%school%identity%'
        )
    $view$;
    revoke all on public.school_identity_review_queue from public, anon, authenticated;
    grant select on public.school_identity_review_queue to service_role;
  end if;
end $$;

commit;
