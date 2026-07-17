begin;

-- Safety check: abort if invalid rows appear before this migration runs.
do $$
begin
  if exists (
    select 1
    from public.teacher_classes
    where class_id is null
  ) then
    raise exception
      'Cannot make teacher_classes.class_id NOT NULL: null rows exist';
  end if;
end
$$;

alter table public.teacher_classes
  alter column class_id set not null;

commit;
