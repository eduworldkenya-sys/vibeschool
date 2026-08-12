begin;

create unique index if not exists uq_students_active_profile_id
  on public.students(profile_id)
  where profile_id is not null and deleted_at is null;

commit;
