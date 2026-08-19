\set ON_ERROR_STOP on

-- Local/disposable-only Task 2 failure injection. This deliberately attempts
-- invalid writes and succeeds only when the reconstructed database rejects them.

do $$
declare
  rejected boolean;
begin
  -- Missing canonical user/profile FK must fail explicitly.
  rejected := false;
  begin
    insert into public.notifications(user_id,title,body,type)
    values (gen_random_uuid(),'task2','fk injection','general');
  exception when foreign_key_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'TASK2 failure injection: notifications accepted orphan user_id';
  end if;

  -- Required identity must reject NULL rather than leaving a partial row.
  rejected := false;
  begin
    insert into public.notifications(user_id,title,body,type)
    values (null,'task2','null injection','general');
  exception when not_null_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'TASK2 failure injection: notifications accepted NULL user_id';
  end if;

  -- Enumerated notification domain must reject impossible values.
  rejected := false;
  begin
    insert into public.notifications(user_id,title,body,type)
    values (gen_random_uuid(),'task2','check injection','not_a_real_notification_type');
  exception
    when check_violation then rejected := true;
    when foreign_key_violation then
      -- FK may be checked before CHECK depending on executor path. Prove the CHECK
      -- exists independently below rather than assuming constraint evaluation order.
      rejected := true;
  end;
  if not rejected then
    raise exception 'TASK2 failure injection: invalid notification type was accepted';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.notifications'::regclass
      and contype='c'
      and pg_get_constraintdef(oid,true) like '%homework_submitted%'
  ) then
    raise exception 'TASK2 failure injection: notification type CHECK missing';
  end if;

  -- Anonymous clients must fail before row-policy evaluation because this is a
  -- private authenticated inbox, not a public relation.
  if has_table_privilege('anon','public.notifications','SELECT')
     or has_table_privilege('anon','public.notifications','INSERT')
     or has_table_privilege('anon','public.notifications','UPDATE')
     or has_table_privilege('anon','public.notifications','DELETE') then
    raise exception 'TASK2 failure injection: anon retains notification table privilege';
  end if;
end $$;

select 'TASK2 DATABASE FAILURE INJECTION PASSED' as result;
