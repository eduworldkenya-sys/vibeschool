begin;

alter table public.vibe_chapter_assignments
  add column resource_id uuid references public.learning_resources(id) on delete restrict,
  add column assignment_type text not null default 'reading',
  add column subject_id uuid references public.subjects(id) on delete set null,
  add column opens_at timestamptz,
  add column instructions text;

alter table public.vibe_chapter_assignments
  add constraint vibe_chapter_assignments_type_check check (assignment_type in ('reading','exercise','homework','project','assessment','remedial','enrichment','revision')),
  add constraint vibe_chapter_assignments_dates_check check (due_at is null or coalesce(opens_at,assigned_at) is null or due_at >= coalesce(opens_at,assigned_at));

create unique index vibe_chapter_assignments_active_identity_uidx
on public.vibe_chapter_assignments(class_id,chapter_id,assignment_type)
where status in ('assigned','active','open');

create or replace function public.ce_validate_classroom_assignment()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare rp uuid; rc uuid; rs text; link_scheme uuid; link_resource uuid; class_school uuid;
begin
 select school_id into class_school from public.classes where id=new.class_id;
 if class_school is null or class_school is distinct from new.school_id then raise exception 'Class/school mismatch'; end if;
 if not exists(select 1 from public.teacher_classes tc where tc.teacher_id=new.teacher_id and tc.school_id=new.school_id and tc.class_id=new.class_id and (new.subject_id is null or tc.subject_id=new.subject_id)) and not public.is_school_admin(new.school_id) then raise exception 'Teacher is not assigned to class/subject'; end if;
 select publication_id,chapter_id,status into rp,rc,rs from public.learning_resources where id=new.resource_id;
 if rp is null then raise exception 'Learning resource does not exist'; end if;
 if rs<>'active' or rp<>new.publication_id or rc<>new.chapter_id then raise exception 'Assignment resource identity mismatch or inactive'; end if;
 if new.resource_link_id is not null then
   select scheme_lesson_id,resource_id into link_scheme,link_resource from public.scheme_lesson_resource_links where id=new.resource_link_id;
   if link_scheme is null or link_resource<>new.resource_id then raise exception 'Scheme resource mismatch'; end if;
 end if;
 if not exists(select 1 from public.vibe_publications p where p.id=new.publication_id and p.status='published') then raise exception 'Publication is not published'; end if;
 new.opens_at:=coalesce(new.opens_at,new.assigned_at,now()); new.updated_at:=now(); return new;
end $$;

drop trigger if exists ce_validate_classroom_assignment on public.vibe_chapter_assignments;
create trigger ce_validate_classroom_assignment before insert or update on public.vibe_chapter_assignments for each row execute function public.ce_validate_classroom_assignment();

create or replace function public.ce_assign_resource_to_class(
 p_resource_id uuid,p_class_id uuid,p_assignment_type text default 'reading',p_subject_id uuid default null,
 p_scheme_resource_link_id uuid default null,p_opens_at timestamptz default now(),p_due_at timestamptz default null,p_instructions text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); school uuid; pub uuid; chap uuid; result_id uuid;
begin
 if caller is null then raise exception 'Authentication required'; end if;
 select tc.school_id into school from public.teacher_classes tc where tc.teacher_id=caller and tc.class_id=p_class_id and (p_subject_id is null or tc.subject_id=p_subject_id) limit 1;
 if school is null then raise exception 'Teacher is not assigned to class/subject'; end if;
 select publication_id,chapter_id into pub,chap from public.learning_resources where id=p_resource_id and source_type='chapter' and status='active';
 if pub is null then raise exception 'Active chapter resource not found'; end if;
 insert into public.vibe_chapter_assignments(teacher_id,school_id,class_id,subject_id,publication_id,chapter_id,resource_id,resource_link_id,assignment_type,assigned_at,opens_at,due_at,status,instructions)
 values(caller,school,p_class_id,p_subject_id,pub,chap,p_resource_id,p_scheme_resource_link_id,p_assignment_type,now(),p_opens_at,p_due_at,'assigned',p_instructions)
 on conflict(class_id,chapter_id,assignment_type) where status in ('assigned','active','open') do update set teacher_id=caller,subject_id=excluded.subject_id,resource_id=excluded.resource_id,resource_link_id=excluded.resource_link_id,opens_at=excluded.opens_at,due_at=excluded.due_at,instructions=excluded.instructions,updated_at=now()
 returning id into result_id;
 insert into public.content_assignment_learners(assignment_id,student_id,status)
 select result_id,sc.student_id,'assigned' from public.student_classes sc where sc.class_id=p_class_id and sc.school_id=school and sc.is_current
 on conflict(assignment_id,student_id) do nothing;
 return result_id;
end $$;

create or replace function public.ce_sync_assignment_learners(p_assignment_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); a public.vibe_chapter_assignments%rowtype; n integer;
begin
 select * into a from public.vibe_chapter_assignments where id=p_assignment_id;
 if not found then raise exception 'Assignment not found'; end if;
 if caller is distinct from a.teacher_id and not public.is_school_admin(a.school_id) then raise exception 'Not authorized'; end if;
 insert into public.content_assignment_learners(assignment_id,student_id,status)
 select a.id,sc.student_id,'assigned' from public.student_classes sc where sc.class_id=a.class_id and sc.school_id=a.school_id and sc.is_current
 on conflict(assignment_id,student_id) do nothing;
 get diagnostics n=row_count; return n;
end $$;

create or replace function public.ce_submit_assignment_evidence(p_assignment_id uuid,p_evidence_type text,p_text_response text default null,p_file_url text default null,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); learner_id uuid; evidence_id uuid;
begin
 select al.id into learner_id from public.content_assignment_learners al join public.students s on s.id=al.student_id where al.assignment_id=p_assignment_id and s.profile_id=caller;
 if learner_id is null then raise exception 'Learner assignment not found'; end if;
 insert into public.content_submission_evidence(assignment_learner_id,evidence_type,text_response,file_url,metadata,submitted_by,status)
 values(learner_id,p_evidence_type,p_text_response,p_file_url,coalesce(p_metadata,'{}'::jsonb),caller,'submitted') returning id into evidence_id;
 update public.content_assignment_learners set status='submitted',submitted_at=now(),updated_at=now() where id=learner_id;
 return evidence_id;
end $$;

revoke all on function public.ce_assign_resource_to_class(uuid,uuid,text,uuid,uuid,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.ce_sync_assignment_learners(uuid) from public,anon;
revoke all on function public.ce_submit_assignment_evidence(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.ce_assign_resource_to_class(uuid,uuid,text,uuid,uuid,timestamptz,timestamptz,text) to authenticated,service_role;
grant execute on function public.ce_sync_assignment_learners(uuid) to authenticated,service_role;
grant execute on function public.ce_submit_assignment_evidence(uuid,text,text,text,jsonb) to authenticated,service_role;

drop policy if exists assignment_learners_teacher_read on public.content_assignment_learners;
create policy assignment_learners_authorized_read on public.content_assignment_learners for select to authenticated using(
 exists(select 1 from public.vibe_chapter_assignments a where a.id=assignment_id and (a.teacher_id=(select auth.uid()) or public.is_school_admin(a.school_id)))
 or exists(select 1 from public.students s where s.id=student_id and s.profile_id=(select auth.uid()))
);
create policy assignment_learners_teacher_manage on public.content_assignment_learners for all to authenticated using(
 exists(select 1 from public.vibe_chapter_assignments a where a.id=assignment_id and (a.teacher_id=(select auth.uid()) or public.is_school_admin(a.school_id)))
) with check(
 exists(select 1 from public.vibe_chapter_assignments a where a.id=assignment_id and (a.teacher_id=(select auth.uid()) or public.is_school_admin(a.school_id)))
);

insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes)
values('classroom_assignment','public.vibe_chapter_assignments','Authoritative classroom delivery of a registered chapter resource',array['public.content_assignment_learners','public.content_submission_evidence'],'Assignments carry resource identity, type, class, subject, lifecycle and learner snapshots.')
on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();

commit;
