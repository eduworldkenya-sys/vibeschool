create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('publication','chapter','vibelearn_content')),
  publication_id uuid references public.vibe_publications(id) on delete cascade,
  chapter_id uuid references public.vibe_chapters(id) on delete cascade,
  content_id uuid references public.vibelearn_content(id) on delete cascade,
  title text not null,
  description text,
  subject_id uuid references public.subjects(id) on delete set null,
  curriculum_id uuid references public.curriculum(id) on delete set null,
  sub_strand_id uuid references public.cbc_strands(id) on delete set null,
  grade text,
  subject text,
  strand text,
  learning_outcomes text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_learning_resource_single_source check (
    ((publication_id is not null)::int + (chapter_id is not null)::int + (content_id is not null)::int) = 1
  ),
  constraint chk_learning_resource_source_type check (
    (source_type='publication' and publication_id is not null)
    or (source_type='chapter' and chapter_id is not null)
    or (source_type='vibelearn_content' and content_id is not null)
  )
);

create unique index if not exists uq_learning_resources_publication on public.learning_resources(publication_id) where publication_id is not null;
create unique index if not exists uq_learning_resources_chapter on public.learning_resources(chapter_id) where chapter_id is not null;
create unique index if not exists uq_learning_resources_content on public.learning_resources(content_id) where content_id is not null;
create index if not exists idx_learning_resources_curriculum on public.learning_resources(curriculum_id, sub_strand_id);
create index if not exists idx_learning_resources_subject_grade on public.learning_resources(subject_id, grade);

create table if not exists public.teaching_resource_links (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.learning_resources(id) on delete cascade,
  target_type text not null check (target_type in ('scheme_lesson','lesson_plan','homework','project','exam','chapter_assignment')),
  scheme_lesson_id uuid references public.scheme_of_work(id) on delete cascade,
  lesson_plan_id uuid references public.lesson_plans(id) on delete cascade,
  homework_id uuid references public.homework(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete cascade,
  chapter_assignment_id uuid references public.vibe_chapter_assignments(id) on delete cascade,
  usage_role text not null check (usage_role in ('source','reference','before_class','in_class','after_class','learner_reading','teacher_notes','homework_source','question_source','project_brief','assessment_source','revision_source')),
  sequence integer not null default 1 check (sequence > 0),
  page_start integer,
  page_end integer,
  section_refs jsonb not null default '[]'::jsonb,
  exercise_refs jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_teaching_link_single_target check (
    ((scheme_lesson_id is not null)::int + (lesson_plan_id is not null)::int + (homework_id is not null)::int + (project_id is not null)::int + (exam_id is not null)::int + (chapter_assignment_id is not null)::int) = 1
  ),
  constraint chk_teaching_link_target_type check (
    (target_type='scheme_lesson' and scheme_lesson_id is not null)
    or (target_type='lesson_plan' and lesson_plan_id is not null)
    or (target_type='homework' and homework_id is not null)
    or (target_type='project' and project_id is not null)
    or (target_type='exam' and exam_id is not null)
    or (target_type='chapter_assignment' and chapter_assignment_id is not null)
  ),
  constraint chk_teaching_link_pages check (
    (page_start is null and page_end is null)
    or (page_start is not null and page_start > 0 and (page_end is null or page_end >= page_start))
  ),
  constraint chk_teaching_link_section_refs check (jsonb_typeof(section_refs)='array'),
  constraint chk_teaching_link_exercise_refs check (jsonb_typeof(exercise_refs)='array')
);

create index if not exists idx_teaching_resource_links_resource on public.teaching_resource_links(resource_id);
create index if not exists idx_teaching_resource_links_scheme on public.teaching_resource_links(scheme_lesson_id) where scheme_lesson_id is not null;
create index if not exists idx_teaching_resource_links_lesson_plan on public.teaching_resource_links(lesson_plan_id) where lesson_plan_id is not null;
create index if not exists idx_teaching_resource_links_homework on public.teaching_resource_links(homework_id) where homework_id is not null;
create index if not exists idx_teaching_resource_links_project on public.teaching_resource_links(project_id) where project_id is not null;
create index if not exists idx_teaching_resource_links_exam on public.teaching_resource_links(exam_id) where exam_id is not null;
create index if not exists idx_teaching_resource_links_assignment on public.teaching_resource_links(chapter_assignment_id) where chapter_assignment_id is not null;

create unique index if not exists uq_teaching_resource_scheme_role on public.teaching_resource_links(resource_id, scheme_lesson_id, usage_role) where scheme_lesson_id is not null;
create unique index if not exists uq_teaching_resource_lesson_role on public.teaching_resource_links(resource_id, lesson_plan_id, usage_role) where lesson_plan_id is not null;
create unique index if not exists uq_teaching_resource_homework_role on public.teaching_resource_links(resource_id, homework_id, usage_role) where homework_id is not null;
create unique index if not exists uq_teaching_resource_project_role on public.teaching_resource_links(resource_id, project_id, usage_role) where project_id is not null;
create unique index if not exists uq_teaching_resource_exam_role on public.teaching_resource_links(resource_id, exam_id, usage_role) where exam_id is not null;
create unique index if not exists uq_teaching_resource_assignment_role on public.teaching_resource_links(resource_id, chapter_assignment_id, usage_role) where chapter_assignment_id is not null;

alter table public.vibe_chapter_assignments add column if not exists resource_link_id uuid references public.scheme_lesson_resource_links(id) on delete set null;
create index if not exists idx_vibe_chapter_assignments_resource_link on public.vibe_chapter_assignments(resource_link_id) where resource_link_id is not null;

create or replace function public.fn_content_os_target_authorized(
  p_target_type text,
  p_scheme_lesson_id uuid,
  p_lesson_plan_id uuid,
  p_homework_id uuid,
  p_project_id uuid,
  p_exam_id uuid,
  p_chapter_assignment_id uuid,
  p_write boolean default false
) returns boolean
language plpgsql
security definer
set search_path='public','auth'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if p_target_type='scheme_lesson' then
    return exists(select 1 from public.scheme_of_work s where s.id=p_scheme_lesson_id and (s.teacher_id=v_uid or public.is_school_admin(s.school_id) or (not p_write and exists(select 1 from public.school_members sm where sm.school_id=s.school_id and sm.profile_id=v_uid))));
  elsif p_target_type='lesson_plan' then
    return exists(select 1 from public.lesson_plans l where l.id=p_lesson_plan_id and (l.teacher_id=v_uid or public.is_school_admin(l.school_id)));
  elsif p_target_type='homework' then
    return exists(select 1 from public.homework h where h.id=p_homework_id and (h.teacher_id=v_uid or public.is_school_admin(h.school_id)));
  elsif p_target_type='project' then
    return exists(select 1 from public.projects p where p.id=p_project_id and (p.teacher_id=v_uid or public.is_school_admin(p.school_id)));
  elsif p_target_type='exam' then
    return exists(select 1 from public.exams e where e.id=p_exam_id and (e.created_by=v_uid or public.is_school_admin(e.school_id)));
  elsif p_target_type='chapter_assignment' then
    return exists(select 1 from public.vibe_chapter_assignments a where a.id=p_chapter_assignment_id and a.teacher_id=v_uid);
  end if;
  return false;
end;
$$;

create or replace function public.fn_learning_resource_visible(p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path='public','auth'
as $$
  select exists(
    select 1
    from public.learning_resources lr
    left join public.vibe_publications vp on vp.id=lr.publication_id
    left join public.vibe_chapters vc on vc.id=lr.chapter_id
    left join public.vibe_publications vcp on vcp.id=vc.publication_id
    left join public.vibelearn_content c on c.id=lr.content_id
    where lr.id=p_resource_id and lr.status='active' and (
      (lr.source_type='publication' and (vp.status='published' or vp.author_id=auth.uid()))
      or (lr.source_type='chapter' and ((vc.status='published' and vcp.status='published') or vcp.author_id=auth.uid()))
      or (lr.source_type='vibelearn_content' and (c.status='live' or c.submitted_by=auth.uid()))
    )
  );
$$;

alter table public.learning_resources enable row level security;
alter table public.teaching_resource_links enable row level security;

drop policy if exists learning_resources_read on public.learning_resources;
create policy learning_resources_read on public.learning_resources for select to authenticated using (public.fn_learning_resource_visible(id));

drop policy if exists learning_resources_manage on public.learning_resources;
create policy learning_resources_manage on public.learning_resources for all to authenticated
using (created_by=(select auth.uid()))
with check (created_by=(select auth.uid()));

drop policy if exists teaching_resource_links_read on public.teaching_resource_links;
create policy teaching_resource_links_read on public.teaching_resource_links for select to authenticated using (
  public.fn_content_os_target_authorized(target_type,scheme_lesson_id,lesson_plan_id,homework_id,project_id,exam_id,chapter_assignment_id,false)
);

drop policy if exists teaching_resource_links_write on public.teaching_resource_links;
create policy teaching_resource_links_write on public.teaching_resource_links for all to authenticated
using (
  created_by=(select auth.uid()) and public.fn_content_os_target_authorized(target_type,scheme_lesson_id,lesson_plan_id,homework_id,project_id,exam_id,chapter_assignment_id,true)
)
with check (
  created_by=(select auth.uid()) and public.fn_content_os_target_authorized(target_type,scheme_lesson_id,lesson_plan_id,homework_id,project_id,exam_id,chapter_assignment_id,true)
);

drop trigger if exists trg_learning_resources_updated_at on public.learning_resources;
create trigger trg_learning_resources_updated_at before update on public.learning_resources for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_teaching_resource_links_updated_at on public.teaching_resource_links;
create trigger trg_teaching_resource_links_updated_at before update on public.teaching_resource_links for each row execute function public.fn_set_updated_at();

insert into public.learning_resources(source_type,publication_id,title,description,subject,grade,status,created_by)
select 'publication', p.id, coalesce(p.title,'Untitled publication'), p.description, p.cbc_subject, p.cbc_grade, case when p.status='published' then 'active' else 'inactive' end, p.author_id
from public.vibe_publications p
on conflict do nothing;

insert into public.learning_resources(source_type,chapter_id,title,description,curriculum_id,sub_strand_id,subject,grade,strand,learning_outcomes,status,created_by)
select 'chapter', c.id, coalesce(c.title,'Untitled chapter'), null, c.curriculum_id, c.sub_strand_id, p.cbc_subject, p.cbc_grade, c.cbc_strand, coalesce(c.learning_outcomes,'{}'::text[]), case when c.status='published' and p.status='published' then 'active' else 'inactive' end, p.author_id
from public.vibe_chapters c join public.vibe_publications p on p.id=c.publication_id
on conflict do nothing;

insert into public.learning_resources(source_type,content_id,title,description,subject_id,status,created_by)
select 'vibelearn_content', c.id, c.title, c.description, c.subject_id, case when c.status='live' then 'active' else 'inactive' end, c.submitted_by
from public.vibelearn_content c
where c.vibe_publication_id is null
on conflict do nothing;

insert into public.teaching_resource_links(resource_id,target_type,scheme_lesson_id,usage_role,sequence,page_start,page_end,exercise_refs,created_by)
select lr.id,'scheme_lesson',sl.scheme_lesson_id,
  case sl.resource_role when 'teacher_reference' then 'reference' when 'before_class' then 'before_class' when 'in_class' then 'in_class' when 'after_class' then 'after_class' when 'homework' then 'homework_source' else 'source' end,
  sl.sequence,sl.page_start,sl.page_end,sl.exercise_refs,sl.created_by
from public.scheme_lesson_resource_links sl
join public.learning_resources lr on lr.chapter_id=sl.chapter_id
on conflict do nothing;

update public.vibe_chapter_assignments a
set resource_link_id = sl.id
from public.scheme_lesson_resource_links sl
where a.resource_link_id is null and a.chapter_id=sl.chapter_id and a.teacher_id=sl.created_by;

revoke execute on function public.fn_content_os_target_authorized(text,uuid,uuid,uuid,uuid,uuid,uuid,boolean) from public, anon;
revoke execute on function public.fn_learning_resource_visible(uuid) from public, anon;
grant execute on function public.fn_content_os_target_authorized(text,uuid,uuid,uuid,uuid,uuid,uuid,boolean) to authenticated, service_role;
grant execute on function public.fn_learning_resource_visible(uuid) to authenticated, service_role;
