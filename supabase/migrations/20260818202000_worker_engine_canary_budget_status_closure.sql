-- Worker Engine canary budget lifecycle closure
-- Production commissioning exposed a contract mismatch: the Gate 2 finalizer
-- transitions execution budgets to `closed`, while the table constraint did not
-- permit that terminal state. Keep the finalizer semantics and make the status
-- vocabulary consistent with the governed lifecycle.

alter table public.hq_workforce_execution_budgets
  drop constraint if exists hq_workforce_execution_budgets_status_check;

alter table public.hq_workforce_execution_budgets
  add constraint hq_workforce_execution_budgets_status_check
  check (status = any (array[
    'active'::text,
    'exhausted'::text,
    'expired'::text,
    'revoked'::text,
    'closed'::text
  ]));

comment on constraint hq_workforce_execution_budgets_status_check
  on public.hq_workforce_execution_budgets
  is 'Execution budget lifecycle states. closed is the successful terminal state used by governed canary finalization.';
