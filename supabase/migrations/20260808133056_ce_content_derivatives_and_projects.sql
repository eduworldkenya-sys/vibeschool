begin;

create table if not exists public.content_derivatives (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  school_id uuid null references public.schools(id) on delete set null,
  class_id uuid null references public.classes(id) on delete set null,
  derivative_type text not null check (derivative_type in ('teacher_notes','learner_notes','revision_notes','slides','project_brief')),
  audience text not null default 'teacher' check (audience in ('teacher','student','parent','class')),
  title text not null check (btrim(title) <> ''),
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object'),
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  source_publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  source_chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  source_resource_id uuid not null references public.learning_resources(id) on delete restrict,
  source_block_id uuid null references public.content_blocks(id) on delete set null,
  source_outcome_id uuid null references public.curriculum_learning_outcomes(id) on delete set null,
  generator text null,
  model text null,
  quality jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_derivatives_creator on public.content_derivatives(created_by, updated_at desc);
create index if not exists idx_content_derivatives_source on public.content_derivatives(source_chapter_id, derivative_type);

alter table public.content_derivatives enable row level security;

drop policy if exists content_derivatives_owner_manage on public.content_derivatives;
create policy content_derivatives_owner_manage on public.content_derivatives
for all to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists content_derivatives_class_read on public.content_derivatives;
create policy content_derivatives_class_read on public.content_derivatives
for select to authenticated
using (
  status = 'approved' and audience in ('student','class') and class_id is not null
  and exists (
    select 1 from public.student_classes sc
    join public.students s on s.id = sc.student_id
    where s.profile_id = auth.uid() and sc.class_id = content_derivatives.class_id and sc.is_current = true
  )
);

create or replace function public.ce_save_content_derivative(
  p_chapter_id uuid,
  p_derivative_type text,
  p_title text,
  p_body jsonb,
  p_class_id uuid default null,
  p_audience text default 'teacher',
  p_generator text default 'content_engine',
  p_model text default null,
  p_quality jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ctx jsonb;
  v_school_id uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_derivative_type not in ('teacher_notes','learner_notes','revision_notes','slides','project_brief') then raise exception 'Unsupported derivative type'; end if;
  if p_audience not in ('teacher','student','parent','class') then raise exception 'Unsupported audience'; end if;
  if p_body is null or jsonb_typeof(p_body) <> 'object' then raise exception 'Derivative body must be an object'; end if;

  v_ctx := public.ce_get_teacher_derivation_context(p_chapter_id);

  if p_class_id is not null then
    select tc.school_id into v_school_id from public.teacher_classes tc
    where tc.teacher_id = v_uid and tc.class_id = p_class_id
    order by tc.created_at asc limit 1;
    if v_school_id is null then raise exception 'Teacher is not assigned to target class'; end if;
  else
    v_school_id := nullif(v_ctx->>'school_id','')::uuid;
  end if;

  insert into public.content_derivatives(
    created_by, school_id, class_id, derivative_type, audience, title, body,
    source_publication_id, source_chapter_id, source_resource_id,
    generator, model, quality
  ) values (
    v_uid, v_school_id, p_class_id, p_derivative_type, p_audience,
    coalesce(nullif(btrim(p_title),''), coalesce(v_ctx->>'chapter_title','Generated material')),
    p_body,
    nullif(v_ctx->>'publication_id','')::uuid,
    p_chapter_id,
    nullif(v_ctx->>'chapter_resource_id','')::uuid,
    p_generator, p_model, coalesce(p_quality,'{}'::jsonb)
  ) returning id into v_id;

  return jsonb_build_object('ok',true,'derivative_id',v_id,'chapter_id',p_chapter_id,'type',p_derivative_type);
end;
$$;

revoke all on function public.ce_save_content_derivative(uuid,text,text,jsonb,uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.ce_save_content_derivative(uuid,text,text,jsonb,uuid,text,text,text,jsonb) to authenticated, service_role;

create or replace function public.ce_create_project_from_payload(
  p_chapter_id uuid,
  p_class_id uuid,
  p_title text,
  p_description text,
  p_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ctx jsonb;
  v_tc record;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_description,'')),'') is null then raise exception 'Project description is required'; end if;
  if p_due_date is not null and p_due_date < current_date then raise exception 'Due date cannot be in the past'; end if;

  v_ctx := public.ce_get_teacher_derivation_context(p_chapter_id);
  select tc.school_id, tc.class_id into v_tc from public.teacher_classes tc
  where tc.teacher_id = v_uid and tc.class_id = p_class_id and tc.school_id is not null
  order by tc.created_at asc limit 1;
  if not found then raise exception 'Teacher is not assigned to target class'; end if;

  insert into public.lesson_projects(
    class_id, teacher_id, school_id, title, description, start_date, due_date, status,
    source_publication_id, source_chapter_id, source_resource_id
  ) values (
    p_class_id, v_uid, v_tc.school_id,
    coalesce(nullif(btrim(p_title),''), coalesce(v_ctx->>'chapter_title','Project')),
    btrim(p_description), current_date, p_due_date, 'assigned',
    nullif(v_ctx->>'publication_id','')::uuid,
    p_chapter_id,
    nullif(v_ctx->>'chapter_resource_id','')::uuid
  ) returning id into v_id;

  return jsonb_build_object('ok',true,'project_id',v_id,'chapter_id',p_chapter_id,'class_id',p_class_id);
end;
$$;

revoke all on function public.ce_create_project_from_payload(uuid,uuid,text,text,date) from public, anon;
grant execute on function public.ce_create_project_from_payload(uuid,uuid,text,text,date) to authenticated, service_role;

commit;
