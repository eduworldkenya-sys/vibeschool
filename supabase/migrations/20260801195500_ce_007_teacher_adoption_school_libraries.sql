begin;

create table public.teacher_resource_adoptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.learning_resources(id) on delete cascade,
  adoption_status text not null default 'active',
  preferred_role text not null default 'supplementary',
  notes text,
  adopted_at timestamptz not null default now(),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (adoption_status in ('active','paused','removed')),
  check (preferred_role in ('primary','supplementary','teacher_reference','learner_reading','exercise','remedial','enrichment','project','assessment_source')),
  unique (teacher_id,resource_id)
);

create table public.school_resource_library (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  resource_id uuid not null references public.learning_resources(id) on delete cascade,
  approval_status text not null default 'approved',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  department text,
  grade text,
  subject_id uuid references public.subjects(id) on delete set null,
  available_from timestamptz,
  available_until timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approval_status in ('pending','approved','rejected','archived')),
  check (available_until is null or available_from is null or available_until >= available_from),
  check (approval_status <> 'approved' or (approved_by is not null and approved_at is not null)),
  unique (school_id,resource_id)
);

create table public.class_resource_library (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.learning_resources(id) on delete cascade,
  usage_role text not null default 'supplementary',
  status text not null default 'active',
  available_from timestamptz,
  available_until timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (usage_role in ('primary','supplementary','teacher_reference','learner_reading','exercise','remedial','enrichment','project','assessment_source')),
  check (status in ('active','paused','removed')),
  check (available_until is null or available_from is null or available_until >= available_from),
  unique (class_id,subject_id,resource_id)
);

create index teacher_resource_adoptions_teacher_status_idx on public.teacher_resource_adoptions(teacher_id,adoption_status);
create index school_resource_library_school_status_idx on public.school_resource_library(school_id,approval_status);
create index class_resource_library_class_status_idx on public.class_resource_library(class_id,status);
create index class_resource_library_teacher_idx on public.class_resource_library(teacher_id);

alter table public.teacher_resource_adoptions enable row level security;
alter table public.school_resource_library enable row level security;
alter table public.class_resource_library enable row level security;

revoke all on public.teacher_resource_adoptions,public.school_resource_library,public.class_resource_library from public,anon,authenticated;
grant select,insert,update,delete on public.teacher_resource_adoptions,public.school_resource_library,public.class_resource_library to authenticated,service_role;

create policy teacher_adoptions_self_manage on public.teacher_resource_adoptions for all to authenticated using (teacher_id=(select auth.uid())) with check (teacher_id=(select auth.uid()));
create policy school_library_member_read on public.school_resource_library for select to authenticated using (exists(select 1 from public.school_members sm where sm.school_id=school_resource_library.school_id and sm.profile_id=(select auth.uid())));
create policy school_library_admin_manage on public.school_resource_library for all to authenticated using (exists(select 1 from public.school_members sm where sm.school_id=school_resource_library.school_id and sm.profile_id=(select auth.uid()) and sm.role::text in ('owner','admin'))) with check (exists(select 1 from public.school_members sm where sm.school_id=school_resource_library.school_id and sm.profile_id=(select auth.uid()) and sm.role::text in ('owner','admin')));
create policy class_library_teacher_read on public.class_resource_library for select to authenticated using (teacher_id=(select auth.uid()) or exists(select 1 from public.teacher_classes tc where tc.school_id=class_resource_library.school_id and tc.class_id=class_resource_library.class_id and tc.teacher_id=(select auth.uid())));
create policy class_library_teacher_manage on public.class_resource_library for all to authenticated using (exists(select 1 from public.teacher_classes tc where tc.school_id=class_resource_library.school_id and tc.class_id=class_resource_library.class_id and tc.teacher_id=(select auth.uid()) and (class_resource_library.subject_id is null or tc.subject_id=class_resource_library.subject_id))) with check (teacher_id=(select auth.uid()) and exists(select 1 from public.teacher_classes tc where tc.school_id=class_resource_library.school_id and tc.class_id=class_resource_library.class_id and tc.teacher_id=(select auth.uid()) and (class_resource_library.subject_id is null or tc.subject_id=class_resource_library.subject_id)));

create function public.ce_validate_resource_adoption() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin if not exists(select 1 from public.learning_resources r where r.id=new.resource_id and r.status='active') then raise exception 'Learning resource % is not active',new.resource_id; end if; new.updated_at:=now(); return new; end $$;
create function public.ce_validate_school_library_resource() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin if not exists(select 1 from public.learning_resources r where r.id=new.resource_id and r.status='active') then raise exception 'Learning resource % is not active',new.resource_id; end if; if new.approval_status='approved' then new.approved_at:=coalesce(new.approved_at,now()); new.approved_by:=coalesce(new.approved_by,auth.uid()); end if; new.updated_at:=now(); return new; end $$;
create function public.ce_validate_class_library_resource() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin if not exists(select 1 from public.learning_resources r where r.id=new.resource_id and r.status='active') then raise exception 'Learning resource % is not active',new.resource_id; end if; if not exists(select 1 from public.classes c where c.id=new.class_id and c.school_id=new.school_id) then raise exception 'Class % does not belong to school %',new.class_id,new.school_id; end if; new.updated_at:=now(); return new; end $$;

create trigger ce_validate_resource_adoption before insert or update on public.teacher_resource_adoptions for each row execute function public.ce_validate_resource_adoption();
create trigger ce_validate_school_library_resource before insert or update on public.school_resource_library for each row execute function public.ce_validate_school_library_resource();
create trigger ce_validate_class_library_resource before insert or update on public.class_resource_library for each row execute function public.ce_validate_class_library_resource();

create function public.ce_adopt_learning_resource(p_resource_id uuid,p_preferred_role text default 'supplementary',p_notes text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ declare caller uuid:=auth.uid(); result_id uuid; begin if caller is null then raise exception 'Authentication required'; end if; insert into public.teacher_resource_adoptions(teacher_id,resource_id,adoption_status,preferred_role,notes) values(caller,p_resource_id,'active',p_preferred_role,p_notes) on conflict(teacher_id,resource_id) do update set adoption_status='active',preferred_role=excluded.preferred_role,notes=excluded.notes,updated_at=now() returning id into result_id; return result_id; end $$;

create function public.ce_add_resource_to_class_library(p_resource_id uuid,p_class_id uuid,p_subject_id uuid default null,p_usage_role text default 'supplementary',p_available_from timestamptz default null,p_available_until timestamptz default null,p_notes text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ declare caller uuid:=auth.uid(); resolved_school uuid; result_id uuid; begin if caller is null then raise exception 'Authentication required'; end if; select tc.school_id into resolved_school from public.teacher_classes tc where tc.teacher_id=caller and tc.class_id=p_class_id and (p_subject_id is null or tc.subject_id=p_subject_id) limit 1; if resolved_school is null then raise exception 'Teacher is not assigned to class % for the selected subject',p_class_id; end if; insert into public.class_resource_library(school_id,class_id,subject_id,teacher_id,resource_id,usage_role,status,available_from,available_until,notes) values(resolved_school,p_class_id,p_subject_id,caller,p_resource_id,p_usage_role,'active',p_available_from,p_available_until,p_notes) on conflict(class_id,subject_id,resource_id) do update set teacher_id=caller,usage_role=excluded.usage_role,status='active',available_from=excluded.available_from,available_until=excluded.available_until,notes=excluded.notes,updated_at=now() returning id into result_id; return result_id; end $$;

revoke all on function public.ce_adopt_learning_resource(uuid,text,text) from public,anon;
revoke all on function public.ce_add_resource_to_class_library(uuid,uuid,uuid,text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.ce_adopt_learning_resource(uuid,text,text) to authenticated,service_role;
grant execute on function public.ce_add_resource_to_class_library(uuid,uuid,uuid,text,timestamptz,timestamptz,text) to authenticated,service_role;

insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes) values
('teacher_adoption','public.teacher_resource_adoptions','Teacher intent to use a learning resource without copying ownership',array['public.class_resource_library'],'Adoption is distinct from learner bookmarking and preserves original authorship.'),
('school_library','public.school_resource_library','School-approved educational resource catalogue',array['public.class_resource_library'],'Only school owners/admins approve resources; members can read approved catalogue entries.'),
('class_library','public.class_resource_library','Teacher-authorized reusable resource catalogue for a class and subject',array['public.scheme_lesson_resource_links','public.vibe_chapter_assignments'],'Class library membership does not itself create a learner assignment.')
on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();

commit;
