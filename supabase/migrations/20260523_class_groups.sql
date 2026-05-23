-- Class Groups for CBC differentiated instruction
create table if not exists class_groups (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  name       text not null,
  color      text not null default '#6d28d9',
  created_at timestamptz default now()
);

create table if not exists class_group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references class_groups(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz default now(),
  unique(group_id, student_id)
);

alter table class_groups enable row level security;
alter table class_group_members enable row level security;

create policy "Teachers manage their class groups"
  on class_groups for all
  using (
    class_id in (
      select id from classes where teacher_id = auth.uid()
    )
  );

create policy "Teachers manage group members"
  on class_group_members for all
  using (
    group_id in (
      select id from class_groups where class_id in (
        select id from classes where teacher_id = auth.uid()
      )
    )
  );
