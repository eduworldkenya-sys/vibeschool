begin;
create table public.content_assessment_blueprints(
 id uuid primary key default gen_random_uuid(), school_id uuid references public.schools(id) on delete cascade,
 teacher_id uuid not null references auth.users(id) on delete cascade, class_id uuid references public.classes(id) on delete set null,
 subject_id uuid references public.subjects(id) on delete set null, title text not null, assessment_type text not null,
 total_marks integer not null, duration_minutes integer, status text not null default 'draft',
 difficulty_distribution jsonb not null default '{}'::jsonb, bloom_distribution jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(btrim(title)<>''), check(assessment_type in('quiz','exercise','homework','project','cat','exam','revision','remedial')),
 check(total_marks>0), check(duration_minutes is null or duration_minutes>0), check(status in('draft','generated','approved','published','archived'))
);
create table public.content_assessment_sources(
 id uuid primary key default gen_random_uuid(), blueprint_id uuid not null references public.content_assessment_blueprints(id) on delete cascade,
 resource_id uuid not null references public.learning_resources(id) on delete restrict,
 scheme_resource_link_id uuid references public.scheme_lesson_resource_links(id) on delete set null,
 outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
 weight numeric(5,2) not null default 1, created_at timestamptz not null default now(),
 check(weight>0), unique(blueprint_id,resource_id,outcome_id)
);
create table public.generated_assessments(
 id uuid primary key default gen_random_uuid(), blueprint_id uuid not null references public.content_assessment_blueprints(id) on delete cascade,
 version integer not null default 1, status text not null default 'draft', total_marks integer not null,
 generated_by uuid references auth.users(id) on delete set null, generated_at timestamptz not null default now(), approved_by uuid references auth.users(id) on delete set null, approved_at timestamptz,
 check(version>0), check(total_marks>0), check(status in('draft','moderation','approved','published','archived')), unique(blueprint_id,version)
);
create table public.generated_assessment_items(
 id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.generated_assessments(id) on delete cascade,
 sequence integer not null, question_type text not null, prompt text not null, options jsonb, answer_key jsonb,
 marks integer not null, difficulty text, bloom_level text, source_resource_id uuid references public.learning_resources(id) on delete set null,
 outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
 source_block_id uuid references public.content_blocks(id) on delete set null, created_at timestamptz not null default now(),
 check(sequence>0), check(btrim(prompt)<>''), check(marks>0),
 check(question_type in('multiple_choice','short_answer','structured','numerical','essay','practical','project','oral','observation')),
 check(difficulty is null or difficulty in('foundation','developing','proficient','advanced')),
 check(bloom_level is null or bloom_level in('remember','understand','apply','analyze','evaluate','create')),
 unique(assessment_id,sequence)
);
create index on public.content_assessment_blueprints(teacher_id,status); create index on public.generated_assessment_items(outcome_id,difficulty);
alter table public.content_assessment_blueprints enable row level security; alter table public.content_assessment_sources enable row level security; alter table public.generated_assessments enable row level security; alter table public.generated_assessment_items enable row level security;
grant select,insert,update,delete on public.content_assessment_blueprints,public.content_assessment_sources,public.generated_assessments,public.generated_assessment_items to authenticated,service_role;
create policy blueprint_teacher_manage on public.content_assessment_blueprints for all to authenticated using(teacher_id=(select auth.uid())) with check(teacher_id=(select auth.uid()));
create policy blueprint_sources_teacher_manage on public.content_assessment_sources for all to authenticated using(exists(select 1 from public.content_assessment_blueprints b where b.id=blueprint_id and b.teacher_id=(select auth.uid()))) with check(exists(select 1 from public.content_assessment_blueprints b where b.id=blueprint_id and b.teacher_id=(select auth.uid())));
create policy generated_assessments_teacher_manage on public.generated_assessments for all to authenticated using(exists(select 1 from public.content_assessment_blueprints b where b.id=blueprint_id and b.teacher_id=(select auth.uid()))) with check(exists(select 1 from public.content_assessment_blueprints b where b.id=blueprint_id and b.teacher_id=(select auth.uid())));
create policy generated_items_teacher_manage on public.generated_assessment_items for all to authenticated using(exists(select 1 from public.generated_assessments a join public.content_assessment_blueprints b on b.id=a.blueprint_id where a.id=assessment_id and b.teacher_id=(select auth.uid()))) with check(exists(select 1 from public.generated_assessments a join public.content_assessment_blueprints b on b.id=a.blueprint_id where a.id=assessment_id and b.teacher_id=(select auth.uid())));
insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes) values('assessment_generation','public.content_assessment_blueprints','Source-grounded assessment blueprint authority',array['public.generated_assessments','public.generated_assessment_items'],'Generated assessment items preserve their resource, block and learning-outcome lineage.') on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();
commit;
