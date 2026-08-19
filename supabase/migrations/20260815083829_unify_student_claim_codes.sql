-- Restored repository copy of production migration 20260815083829.
-- Production migration ledger: unify_student_claim_codes.
-- The durable contract introduced independent Student and Parent redemption
-- attribution while retaining the legacy shared claimed/claimed_at fields.

alter table public.student_claim_codes
  add column if not exists student_claimed_at timestamptz,
  add column if not exists student_claimed_by uuid,
  add column if not exists parent_claimed_at timestamptz,
  add column if not exists parent_claimed_by uuid;

update public.student_claim_codes
set student_claimed_at = claimed_at,
    student_claimed_by = claimed_by
where role = 'student' and claimed = true;

update public.student_claim_codes
set parent_claimed_at = claimed_at,
    parent_claimed_by = claimed_by
where role = 'parent' and claimed = true;

-- Historical production reconciliation collapsed duplicate student+parent claim
-- rows into one canonical row while preserving both attribution lanes.
with parent_rows as (
  select scc.*
  from public.student_claim_codes scc
  where scc.role = 'parent'
    and scc.student_id in (
      select student_id
      from public.student_claim_codes
      group by student_id
      having count(*) > 1
    )
)
update public.student_claim_codes s
set parent_claimed_at = pr.parent_claimed_at,
    parent_claimed_by = pr.parent_claimed_by
from parent_rows pr
where s.student_id = pr.student_id
  and s.role = 'student';

delete from public.student_claim_codes scc
using (
  select student_id
  from public.student_claim_codes
  group by student_id
  having count(*) > 1
) d
where scc.student_id = d.student_id
  and scc.role = 'parent';
