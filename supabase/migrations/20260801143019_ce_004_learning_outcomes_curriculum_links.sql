begin;

create table public.curriculum_learning_outcomes (
  id uuid primary key default gen_random_uuid(), curriculum_id uuid references public.curriculum(id) on delete cascade,
  sub_strand_id uuid references public.cbc_strands(id) on delete set null, outcome_text text not null, outcome_code text,
  source_type text not null default 'creator_claimed', source_ref text, bloom_level text, difficulty text,
  competency_tags text[] not null default '{}', status text not null default 'draft',
  verified_by uuid references auth.users(id) on delete set null, verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint curriculum_learning_outcomes_text_nonempty check (btrim(outcome_text)<>''),
  constraint curriculum_learning_outcomes_source_check check (source_type in ('official','publisher','creator_claimed','school','generated')),
  constraint curriculum_learning_outcomes_status_check check (status in ('draft','verified','rejected','archived')),
  constraint curriculum_learning_outcomes_bloom_check check (bloom_level is null or bloom_level in ('remember','understand','apply','analyze','evaluate','create')),
  constraint curriculum_learning_outcomes_difficulty_check check (difficulty is null or difficulty in ('foundation','developing','proficient','advanced')),
  constraint curriculum_learning_outcomes_verified_check check (status<>'verified' or (verified_by is not null and verified_at is not null)),
  constraint curriculum_learning_outcomes_authority_check check (curriculum_id is not null or sub_strand_id is not null or (source_type='creator_claimed' and source_ref like 'chapter:%'))
);
create unique index curriculum_learning_outcomes_identity_uidx on public.curriculum_learning_outcomes(coalesce(curriculum_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(sub_strand_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(btrim(outcome_text)),source_type);
create index curriculum_learning_outcomes_curriculum_idx on public.curriculum_learning_outcomes(curriculum_id);
create index curriculum_learning_outcomes_substrand_idx on public.curriculum_learning_outcomes(sub_strand_id);
create index curriculum_learning_outcomes_status_idx on public.curriculum_learning_outcomes(status);
create index curriculum_learning_outcomes_tags_gin_idx on public.curriculum_learning_outcomes using gin(competency_tags);

create table public.chapter_learning_outcome_links (
 id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.vibe_publications(id) on delete cascade,
 chapter_id uuid not null references public.vibe_chapters(id) on delete cascade, outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
 alignment_strength text not null default 'supports', sequence integer not null default 1, evidence_note text,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint chapter_learning_outcome_links_strength_check check (alignment_strength in ('introduces','supports','assesses','masters')),
 constraint chapter_learning_outcome_links_sequence_positive check(sequence>0), constraint chapter_learning_outcome_links_unique unique(chapter_id,outcome_id)
);
create table public.content_block_outcome_links (
 id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.vibe_publications(id) on delete cascade,
 chapter_id uuid not null references public.vibe_chapters(id) on delete cascade, content_block_id uuid not null references public.content_blocks(id) on delete cascade,
 outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade, relationship text not null default 'supports',
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 constraint content_block_outcome_links_relationship_check check(relationship in ('explains','practises','assesses','remediates','enriches','supports')),
 constraint content_block_outcome_links_unique unique(content_block_id,outcome_id)
);
create index chapter_learning_outcome_links_outcome_idx on public.chapter_learning_outcome_links(outcome_id);
create index content_block_outcome_links_outcome_idx on public.content_block_outcome_links(outcome_id);
create index content_block_outcome_links_chapter_idx on public.content_block_outcome_links(chapter_id);

alter table public.curriculum_learning_outcomes enable row level security;
alter table public.chapter_learning_outcome_links enable row level security;
alter table public.content_block_outcome_links enable row level security;
revoke all on public.curriculum_learning_outcomes,public.chapter_learning_outcome_links,public.content_block_outcome_links from public,anon,authenticated;
grant select on public.curriculum_learning_outcomes,public.chapter_learning_outcome_links,public.content_block_outcome_links to anon,authenticated;
grant insert,update,delete on public.curriculum_learning_outcomes,public.chapter_learning_outcome_links,public.content_block_outcome_links to authenticated,service_role;

create policy curriculum_learning_outcomes_public_read on public.curriculum_learning_outcomes for select to anon,authenticated using(status='verified');
create policy curriculum_learning_outcomes_creator_read on public.curriculum_learning_outcomes for select to authenticated using(created_by=(select auth.uid()));
create policy curriculum_learning_outcomes_creator_insert on public.curriculum_learning_outcomes for insert to authenticated with check(created_by=(select auth.uid()) and source_type in('creator_claimed','school','generated') and status='draft');
create policy curriculum_learning_outcomes_creator_update on public.curriculum_learning_outcomes for update to authenticated using(created_by=(select auth.uid()) and status='draft') with check(created_by=(select auth.uid()) and source_type in('creator_claimed','school','generated') and status='draft');
create policy curriculum_learning_outcomes_creator_delete on public.curriculum_learning_outcomes for delete to authenticated using(created_by=(select auth.uid()) and status='draft');
create policy chapter_outcome_links_public_read on public.chapter_learning_outcome_links for select to anon,authenticated using(exists(select 1 from public.vibe_publications p where p.id=publication_id and p.status='published') and exists(select 1 from public.curriculum_learning_outcomes o where o.id=outcome_id and o.status='verified'));
create policy chapter_outcome_links_author_manage on public.chapter_learning_outcome_links for all to authenticated using(exists(select 1 from public.vibe_publications p where p.id=publication_id and p.author_id=(select auth.uid()))) with check(exists(select 1 from public.vibe_publications p where p.id=publication_id and p.author_id=(select auth.uid())));
create policy block_outcome_links_public_read on public.content_block_outcome_links for select to anon,authenticated using(exists(select 1 from public.vibe_publications p where p.id=publication_id and p.status='published') and exists(select 1 from public.curriculum_learning_outcomes o where o.id=outcome_id and o.status='verified'));
create policy block_outcome_links_author_manage on public.content_block_outcome_links for all to authenticated using(exists(select 1 from public.vibe_publications p where p.id=publication_id and p.author_id=(select auth.uid()))) with check(exists(select 1 from public.vibe_publications p where p.id=publication_id and p.author_id=(select auth.uid())));

insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes) values
('learning_outcome','public.curriculum_learning_outcomes','Normalized curriculum learning-outcome authority',array['public.vibe_chapters.learning_outcomes','public.learner_outcomes'],'Creator chapter arrays are normalized as draft creator-claimed outcomes; verified official outcomes can later replace them without losing lineage.'),
('chapter_outcome_alignment','public.chapter_learning_outcome_links','Authoritative chapter-to-learning-outcome alignment',array['public.content_block_outcome_links'],'A content block may link only to an outcome already linked to its chapter.')
on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();

commit;
