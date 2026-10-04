-- Reconcile production table privileges with the canonical RLS contract.
revoke all on table public.exam_subject_config from anon;
revoke all on table public.exam_subject_config from authenticated;
grant select, insert, update, delete on table public.exam_subject_config to authenticated;
