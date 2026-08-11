-- TBL-011 reproducible-baseline prerequisite.
-- CE-016 still references the historical parent_students relation, while the
-- canonical guardian relationship is parent_student_links. Preserve the old
-- read contract as a compatibility view rather than creating a second source
-- of truth.

create or replace view public.parent_students
with (security_invoker = true)
as
select
  psl.id,
  psl.parent_id,
  psl.student_id,
  psl.school_id,
  psl.relationship,
  psl.is_primary,
  psl.created_at,
  psl.updated_at
from public.parent_student_links psl;

revoke all on table public.parent_students from public, anon;
grant select on table public.parent_students to authenticated, service_role;
