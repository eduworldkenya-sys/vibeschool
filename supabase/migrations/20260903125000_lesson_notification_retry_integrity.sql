begin;

-- Consequence delivery must be retry-safe. A lesson publication may be retried
-- after a transient client/network error; the same learner must not receive the
-- same notification more than once for the same related object.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_user_type_related_key'
  ) then
    alter table public.notifications
      add constraint notifications_user_type_related_key
      unique (user_id, type, related_id);
  end if;
end;
$$;

commit;
