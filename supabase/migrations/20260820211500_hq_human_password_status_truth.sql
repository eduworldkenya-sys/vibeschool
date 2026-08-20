-- Reconcile existing HQ human member status from Auth password-readiness metadata.
update public.hq_human_members m
set status = case
  when m.role = 'founder' then 'active'
  when coalesce((u.raw_user_meta_data->>'hq_password_ready')::boolean, false) then 'active'
  when u.email_confirmed_at is not null then 'setup_required'
  else 'invited'
end,
updated_at = now()
from auth.users u
where u.id = m.profile_id
  and m.status not in ('suspended','revoked');
