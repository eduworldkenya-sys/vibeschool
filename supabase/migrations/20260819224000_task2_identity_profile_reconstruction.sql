-- Task 2: recover production-only identity/profile dependencies into repository truth.
-- authorization-test: public.relationship_types
-- authorization-test: public.gender_types
-- authorization-test: public.audit_logs
-- authorization-test: public.admin_profiles
-- authorization-test: public.parent_profiles
-- authorization-test: public.student_profiles
-- authorization-test: public.teacher_profiles
--
-- Blank reconstruction proved these contracts were absent even though production and
-- application/security functions depend on them. This forward migration is ordered as:
-- catalogue -> audit sink -> role-profile tables -> verifier function -> triggers -> RLS/grants.
-- Existing production data must never be rewritten by this recovery migration.

create table if not exists public.relationship_types (
  code text primary key,
  label text not null
);

insert into public.relationship_types(code,label) values
  ('father','Father'),
  ('guardian','Guardian'),
  ('mother','Mother'),
  ('other','Other'),
  ('parent','Parent')
on conflict (code) do update set label = excluded.label;

create table if not exists public.gender_types (
  code text primary key,
  label text not null
);

insert into public.gender_types(code,label) values
  ('female','Female'),
  ('male','Male'),
  ('other','Other')
on conflict (code) do update set label = excluded.label;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  actor_snapshot jsonb not null,
  table_name text not null,
  table_record_id text not null,
  operation text not null,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  ip_masked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint audit_logs_operation_check check (operation = any (array['INSERT'::text,'UPDATE'::text,'DELETE'::text])),
  constraint chk_delete_no_new check (operation <> 'DELETE'::text or new_data is null),
  constraint chk_insert_has_new check (operation <> 'INSERT'::text or new_data is not null),
  constraint chk_insert_no_old check (operation <> 'INSERT'::text or old_data is null)
);
create index if not exists idx_audit_actor_created on public.audit_logs(actor_id, created_at);

create table if not exists public.admin_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  title text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists idx_admin_profiles_school on public.admin_profiles(school_id);

create table if not exists public.parent_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  relationship text not null default 'guardian' references public.relationship_types(code),
  occupation text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.student_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  admission_no text,
  gender text references public.gender_types(code),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint fk_student_profiles_user foreign key (profile_id) references auth.users(id) on delete cascade,
  constraint uq_admission_per_school unique (school_id, admission_no)
);
create index if not exists idx_student_profiles_school on public.student_profiles(school_id);

create table if not exists public.teacher_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  tsc_number text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  employment_type text,
  subjects_taught text[],
  designation text,
  gender text,
  date_of_birth date,
  nationality text,
  qualifications jsonb default '[]'::jsonb,
  professional_dev jsonb default '[]'::jsonb,
  teaching_style text,
  twin_notes text,
  leave_balance integer default 0,
  appraisal_score numeric(4,2),
  appraisal_notes text,
  finance_ref text,
  documents jsonb default '[]'::jsonb,
  constraint uq_tsc_per_school unique (school_id, tsc_number)
);
create index if not exists idx_teacher_profiles_school on public.teacher_profiles(school_id);

-- Existing production relations must match the recovered identity spine. Fail closed
-- rather than silently blessing a differently-shaped table.
do $$
declare
  missing text[];
begin
  with expected(table_name,column_name,udt_name,is_nullable) as (
    values
      ('audit_logs','id','uuid','NO'),('audit_logs','actor_id','uuid','YES'),
      ('audit_logs','actor_snapshot','jsonb','NO'),('audit_logs','table_name','text','NO'),
      ('audit_logs','table_record_id','text','NO'),('audit_logs','operation','text','NO'),
      ('admin_profiles','profile_id','uuid','NO'),('admin_profiles','school_id','uuid','NO'),
      ('parent_profiles','profile_id','uuid','NO'),('parent_profiles','relationship','text','NO'),
      ('student_profiles','profile_id','uuid','NO'),('student_profiles','school_id','uuid','NO'),
      ('teacher_profiles','profile_id','uuid','NO'),('teacher_profiles','school_id','uuid','YES'),
      ('teacher_profiles','tsc_number','text','YES')
  )
  select array_agg(e.table_name || '.' || e.column_name order by e.table_name,e.column_name)
  into missing
  from expected e
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name=e.table_name and c.column_name=e.column_name
  where c.column_name is null or c.udt_name<>e.udt_name or c.is_nullable<>e.is_nullable;
  if missing is not null then
    raise exception 'Task2 identity-profile contract mismatch: %', array_to_string(missing, ', ');
  end if;
end $$;

create or replace function public.fn_verify_role_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expected_role public.member_role;
begin
  v_expected_role := case tg_table_name
    when 'teacher_profiles' then 'teacher'::public.member_role
    when 'student_profiles' then 'student'::public.member_role
    when 'admin_profiles' then 'admin'::public.member_role
    else null
  end;
  if v_expected_role is null or new.school_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.school_members sm
    where sm.school_id=new.school_id
      and sm.profile_id=new.profile_id
      and sm.role=v_expected_role
  ) then
    raise exception 'Profile % does not have role % in school % — cannot create % row.',
      new.profile_id,v_expected_role,new.school_id,tg_table_name;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_admin_profiles_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_updated_at before update on public.admin_profiles
for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_parent_profiles_updated_at on public.parent_profiles;
create trigger trg_parent_profiles_updated_at before update on public.parent_profiles
for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_student_profiles_updated_at on public.student_profiles;
create trigger trg_student_profiles_updated_at before update on public.student_profiles
for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_teacher_profiles_updated_at on public.teacher_profiles;
create trigger trg_teacher_profiles_updated_at before update on public.teacher_profiles
for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_verify_admin_role on public.admin_profiles;
create trigger trg_verify_admin_role before insert or update of school_id on public.admin_profiles
for each row execute function public.fn_verify_role_membership();
drop trigger if exists trg_verify_student_role on public.student_profiles;
create trigger trg_verify_student_role before insert or update of school_id on public.student_profiles
for each row execute function public.fn_verify_role_membership();
drop trigger if exists trg_verify_teacher_role on public.teacher_profiles;
create trigger trg_verify_teacher_role before insert or update of school_id on public.teacher_profiles
for each row execute function public.fn_verify_role_membership();

drop trigger if exists trg_audit_admin_profiles on public.admin_profiles;
create trigger trg_audit_admin_profiles after insert or update or delete on public.admin_profiles
for each row execute function public.fn_audit_log();
drop trigger if exists trg_audit_parent_profiles on public.parent_profiles;
create trigger trg_audit_parent_profiles after insert or update or delete on public.parent_profiles
for each row execute function public.fn_audit_log();
drop trigger if exists trg_audit_student_profiles on public.student_profiles;
create trigger trg_audit_student_profiles after insert or update or delete on public.student_profiles
for each row execute function public.fn_audit_log();
drop trigger if exists trg_audit_teacher_profiles on public.teacher_profiles;
create trigger trg_audit_teacher_profiles after insert or update or delete on public.teacher_profiles
for each row execute function public.fn_audit_log();

alter table public.relationship_types enable row level security;
alter table public.gender_types enable row level security;
alter table public.audit_logs enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.parent_profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.teacher_profiles enable row level security;

drop policy if exists relationship_types_read on public.relationship_types;
create policy relationship_types_read on public.relationship_types for select to authenticated
using (true);
drop policy if exists gender_types_read on public.gender_types;
create policy gender_types_read on public.gender_types for select to authenticated
using (true);

drop policy if exists audit_logs_hq_owner_read on public.audit_logs;
create policy audit_logs_hq_owner_read on public.audit_logs for select to authenticated
using (public.is_platform_owner());

drop policy if exists task2_admin_profiles_select on public.admin_profiles;
create policy task2_admin_profiles_select on public.admin_profiles for select to authenticated
using (
  profile_id=auth.uid() or exists (
    select 1 from public.school_members sm
    where sm.school_id=admin_profiles.school_id and sm.profile_id=auth.uid()
      and sm.role=any(array['owner'::public.member_role,'admin'::public.member_role])
  )
);
drop policy if exists task2_admin_profiles_insert on public.admin_profiles;
create policy task2_admin_profiles_insert on public.admin_profiles for insert to authenticated
with check (profile_id=auth.uid());
drop policy if exists task2_admin_profiles_update on public.admin_profiles;
create policy task2_admin_profiles_update on public.admin_profiles for update to authenticated
using (profile_id=auth.uid()) with check (profile_id=auth.uid());
drop policy if exists task2_admin_profiles_delete on public.admin_profiles;
create policy task2_admin_profiles_delete on public.admin_profiles for delete to authenticated
using (exists (
  select 1 from public.school_members sm
  where sm.school_id=admin_profiles.school_id and sm.profile_id=auth.uid()
    and sm.role=any(array['owner'::public.member_role,'admin'::public.member_role])
));

drop policy if exists task2_parent_profiles_select on public.parent_profiles;
create policy task2_parent_profiles_select on public.parent_profiles for select to authenticated
using (
  profile_id=auth.uid()
  or exists (
    select 1 from public.parent_student_links psl
    join public.students s on s.id=psl.student_id
    join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
    join public.teacher_classes tc on tc.class_id=sc.class_id and tc.school_id=sc.school_id
    where psl.parent_id=parent_profiles.profile_id and tc.teacher_id=auth.uid()
  )
  or exists (
    select 1 from public.parent_student_links psl
    join public.school_members sm on sm.school_id=psl.school_id
    where psl.parent_id=parent_profiles.profile_id and sm.profile_id=auth.uid()
      and sm.role=any(array['owner'::public.member_role,'admin'::public.member_role])
  )
);
drop policy if exists task2_parent_profiles_insert on public.parent_profiles;
create policy task2_parent_profiles_insert on public.parent_profiles for insert to authenticated
with check (profile_id=auth.uid());
drop policy if exists task2_parent_profiles_update on public.parent_profiles;
create policy task2_parent_profiles_update on public.parent_profiles for update to authenticated
using (profile_id=auth.uid()) with check (profile_id=auth.uid());
drop policy if exists task2_parent_profiles_delete on public.parent_profiles;
create policy task2_parent_profiles_delete on public.parent_profiles for delete to authenticated
using (profile_id=auth.uid());

drop policy if exists task2_student_profiles_select on public.student_profiles;
create policy task2_student_profiles_select on public.student_profiles for select to authenticated
using (
  profile_id=auth.uid()
  or exists (
    select 1 from public.students s
    join public.parent_student_links psl on psl.student_id=s.id
    where s.profile_id=student_profiles.profile_id and psl.parent_id=auth.uid()
  )
  or exists (
    select 1 from public.school_members sm
    where sm.school_id=student_profiles.school_id and sm.profile_id=auth.uid()
      and sm.role=any(array['owner'::public.member_role,'admin'::public.member_role])
  )
  or exists (
    select 1 from public.students s
    join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
    join public.teacher_classes tc on tc.class_id=sc.class_id and tc.school_id=sc.school_id
    where s.profile_id=student_profiles.profile_id and tc.teacher_id=auth.uid()
  )
);
drop policy if exists task2_student_profiles_insert on public.student_profiles;
create policy task2_student_profiles_insert on public.student_profiles for insert to authenticated
with check (profile_id=auth.uid());
drop policy if exists task2_student_profiles_update on public.student_profiles;
create policy task2_student_profiles_update on public.student_profiles for update to authenticated
using (
  profile_id=auth.uid() or exists (
    select 1 from public.school_members sm
    where sm.school_id=student_profiles.school_id and sm.profile_id=auth.uid()
      and sm.role=any(array['owner'::public.member_role,'admin'::public.member_role])
  )
)
with check (
  profile_id=auth.uid() or exists (
    select 1 from public.school_members sm
    where sm.school_id=student_profiles.school_id and sm.profile_id=auth.uid()
      and sm.role=any(array['owner'::public.member_role,'admin'::public.member_role])
  )
);
drop policy if exists task2_student_profiles_delete on public.student_profiles;
create policy task2_student_profiles_delete on public.student_profiles for delete to authenticated
using (exists (
  select 1 from public.school_members sm
  where sm.school_id=student_profiles.school_id and sm.profile_id=auth.uid()
    and sm.role=any(array['owner'::public.member_role,'admin'::public.member_role])
));

drop policy if exists task2_teacher_profiles_select on public.teacher_profiles;
create policy task2_teacher_profiles_select on public.teacher_profiles for select to authenticated
using (
  profile_id=auth.uid() or exists (
    select 1 from public.school_members sm
    where sm.school_id=teacher_profiles.school_id and sm.profile_id=auth.uid()
      and sm.role=any(array['owner'::public.member_role,'admin'::public.member_role])
  )
);
drop policy if exists task2_teacher_profiles_insert on public.teacher_profiles;
create policy task2_teacher_profiles_insert on public.teacher_profiles for insert to authenticated
with check (profile_id=auth.uid());
drop policy if exists task2_teacher_profiles_update on public.teacher_profiles;
create policy task2_teacher_profiles_update on public.teacher_profiles for update to authenticated
using (profile_id=auth.uid()) with check (profile_id=auth.uid());
drop policy if exists task2_teacher_profiles_delete on public.teacher_profiles;
create policy task2_teacher_profiles_delete on public.teacher_profiles for delete to authenticated
using (exists (
  select 1 from public.school_members sm
  where sm.school_id=teacher_profiles.school_id and sm.profile_id=auth.uid()
    and sm.role=any(array['owner'::public.member_role,'admin'::public.member_role])
));

drop policy if exists pol_admin_profiles_delete on public.admin_profiles;
drop policy if exists pol_admin_profiles_insert on public.admin_profiles;
drop policy if exists pol_admin_profiles_select on public.admin_profiles;
drop policy if exists pol_admin_profiles_update on public.admin_profiles;
drop policy if exists pol_parent_profiles_delete on public.parent_profiles;
drop policy if exists pol_parent_profiles_insert on public.parent_profiles;
drop policy if exists pol_parent_profiles_select on public.parent_profiles;
drop policy if exists pol_parent_profiles_update on public.parent_profiles;
drop policy if exists pol_student_profiles_delete on public.student_profiles;
drop policy if exists pol_student_profiles_insert on public.student_profiles;
drop policy if exists pol_student_profiles_select on public.student_profiles;
drop policy if exists pol_student_profiles_update on public.student_profiles;
drop policy if exists student_profiles_admin_read on public.student_profiles;
drop policy if exists student_profiles_own on public.student_profiles;
drop policy if exists student_profiles_parent_read on public.student_profiles;
drop policy if exists student_profiles_teacher_read on public.student_profiles;
drop policy if exists pol_teacher_profiles_delete on public.teacher_profiles;
drop policy if exists pol_teacher_profiles_insert on public.teacher_profiles;
drop policy if exists pol_teacher_profiles_select on public.teacher_profiles;
drop policy if exists pol_teacher_profiles_update on public.teacher_profiles;

revoke all on table public.relationship_types from anon;
revoke all on table public.gender_types from anon;
revoke all on table public.audit_logs from anon;
revoke all on table public.admin_profiles from anon;
revoke all on table public.parent_profiles from anon;
revoke all on table public.student_profiles from anon;
revoke all on table public.teacher_profiles from anon;

revoke all on table public.relationship_types from authenticated;
revoke all on table public.gender_types from authenticated;
revoke all on table public.audit_logs from authenticated;
revoke all on table public.admin_profiles from authenticated;
revoke all on table public.parent_profiles from authenticated;
revoke all on table public.student_profiles from authenticated;
revoke all on table public.teacher_profiles from authenticated;

grant select on table public.relationship_types, public.gender_types to authenticated;
grant select on table public.audit_logs to authenticated;
grant select,insert,update,delete on table public.admin_profiles, public.parent_profiles,
  public.student_profiles, public.teacher_profiles to authenticated;
grant all on table public.relationship_types, public.gender_types, public.audit_logs,
  public.admin_profiles, public.parent_profiles, public.student_profiles,
  public.teacher_profiles to service_role;

revoke all on function public.fn_verify_role_membership() from public, anon, authenticated;
grant execute on function public.fn_verify_role_membership() to service_role;

comment on table public.audit_logs is 'Canonical audit sink recovered into repository truth by Task 2.';
comment on table public.student_profiles is 'Legacy role-specific student profile projection. Canonical learner identity remains public.students(id).';
