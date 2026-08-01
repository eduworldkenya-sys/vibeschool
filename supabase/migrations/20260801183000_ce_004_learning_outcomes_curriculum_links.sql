begin;

create table public.curriculum_learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid references public.curriculum(id) on delete cascade,
  sub_strand_id uuid references public.cbc_strands(id) on delete set null,
  outcome_text text not null,
  outcome_code text,
  source_type text not null default 'creator_claimed',
  source_ref text,
  bloom_level text,
  difficulty text,
  competency_tags text[] not null default '{}',
  status text not null default 'draft',
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_learning_outcomes_text_nonempty check (btrim(outcome_text) <> ''),
  constraint curriculum_learning_outcomes_source_check check (source_type in ('official','publisher','creator_claimed','school','generated')),
  constraint curriculum_learning_outcomes_status_check check (status in ('draft','verified','rejected','archived')),
  constraint curriculum_learning_outcomes_bloom_check check (bloom_level is null or bloom_level in ('remember','understand','apply','analyze','evaluate','create')),
  constraint curriculum_learning_outcomes_difficulty_check check (difficulty is null or difficulty in ('foundation','developing','proficient','advanced')),
  constraint curriculum_learning_outcomes_verified_check check (status <> 'verified' or (verified_by is not null and verified_at is not null)),
  constraint curriculum_learning_outcomes_authority_check check (
    curriculum_id is not null or sub_strand_id is not null
    or (source_type = 'creator_claimed' and source_ref like 'chapter:%')
  )
);

create unique index curriculum_learning_outcomes_identity_uidx
  on public.curriculum_learning_outcomes(
    coalesce(curriculum_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(sub_strand_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(outcome_text)),
    source_type
  );
create index curriculum_learning_outcomes_curriculum_idx on public.curriculum_learning_outcomes(curriculum_id);
create index curriculum_learning_outcomes_substrand_idx on public.curriculum_learning_outcomes(sub_strand_id);
create index curriculum_learning_outcomes_status_idx on public.curriculum_learning_outcomes(status);
create index curriculum_learning_outcomes_tags_gin_idx on public.curriculum_learning_outcomes using gin(competency_tags);

create table public.chapter_learning_outcome_links (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
  alignment_strength text not null default 'supports',
  sequence integer not null default 1,
  evidence_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chapter_learning_outcome_links_strength_check check (alignment_strength in ('introduces','supports','assesses','masters')),
  constraint chapter_learning_outcome_links_sequence_positive check (sequence > 0),
  constraint chapter_learning_outcome_links_unique unique (chapter_id, outcome_id)
);

create table public.content_block_outcome_links (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  content_block_id uuid not null references public.content_blocks(id) on delete cascade,
  outcome_id uuid not null references public.curriculum_learning_outcomes(id) on delete cascade,
  relationship text not null default 'supports',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint content_block_outcome_links_relationship_check check (relationship in ('explains','practises','assesses','remediates','enriches','supports')),
  constraint content_block_outcome_links_unique unique (content_block_id, outcome_id)
);

create index chapter_learning_outcome_links_outcome_idx on public.chapter_learning_outcome_links(outcome_id);
create index content_block_outcome_links_outcome_idx on public.content_block_outcome_links(outcome_id);
create index content_block_outcome_links_chapter_idx on public.content_block_outcome_links(chapter_id);

alter table public.curriculum_learning_outcomes enable row level security;
alter table public.chapter_learning_outcome_links enable row level security;
alter table public.content_block_outcome_links enable row level security;

revoke all on public.curriculum_learning_outcomes, public.chapter_learning_outcome_links, public.content_block_outcome_links from public, anon, authenticated;
grant select on public.curriculum_learning_outcomes, public.chapter_learning_outcome_links, public.content_block_outcome_links to anon, authenticated;
grant insert, update, delete on public.curriculum_learning_outcomes, public.chapter_learning_outcome_links, public.content_block_outcome_links to authenticated, service_role;

create policy curriculum_learning_outcomes_public_read on public.curriculum_learning_outcomes for select to anon, authenticated using (status = 'verified');
create policy curriculum_learning_outcomes_creator_read on public.curriculum_learning_outcomes for select to authenticated using (created_by = (select auth.uid()));
create policy curriculum_learning_outcomes_creator_insert on public.curriculum_learning_outcomes for insert to authenticated with check (created_by = (select auth.uid()) and source_type in ('creator_claimed','school','generated') and status = 'draft');
create policy curriculum_learning_outcomes_creator_update on public.curriculum_learning_outcomes for update to authenticated using (created_by = (select auth.uid()) and status = 'draft') with check (created_by = (select auth.uid()) and source_type in ('creator_claimed','school','generated') and status = 'draft');
create policy curriculum_learning_outcomes_creator_delete on public.curriculum_learning_outcomes for delete to authenticated using (created_by = (select auth.uid()) and status = 'draft');

create policy chapter_outcome_links_public_read on public.chapter_learning_outcome_links for select to anon, authenticated
using (
  exists (select 1 from public.vibe_publications p where p.id = publication_id and p.status = 'published')
  and exists (select 1 from public.curriculum_learning_outcomes o where o.id = outcome_id and o.status = 'verified')
);
create policy chapter_outcome_links_author_manage on public.chapter_learning_outcome_links for all to authenticated
using (exists (select 1 from public.vibe_publications p where p.id = publication_id and p.author_id = (select auth.uid())))
with check (exists (select 1 from public.vibe_publications p where p.id = publication_id and p.author_id = (select auth.uid())));

create policy block_outcome_links_public_read on public.content_block_outcome_links for select to anon, authenticated
using (
  exists (select 1 from public.vibe_publications p where p.id = publication_id and p.status = 'published')
  and exists (select 1 from public.curriculum_learning_outcomes o where o.id = outcome_id and o.status = 'verified')
);
create policy block_outcome_links_author_manage on public.content_block_outcome_links for all to authenticated
using (exists (select 1 from public.vibe_publications p where p.id = publication_id and p.author_id = (select auth.uid())))
with check (exists (select 1 from public.vibe_publications p where p.id = publication_id and p.author_id = (select auth.uid())));

create function public.ce_validate_chapter_outcome_link()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare chapter_publication uuid; outcome_curriculum uuid; chapter_curriculum uuid;
begin
  select publication_id, curriculum_id into chapter_publication, chapter_curriculum from public.vibe_chapters where id = new.chapter_id;
  if chapter_publication is null then raise exception 'Chapter does not exist'; end if;
  if chapter_publication <> new.publication_id then raise exception 'Chapter/publication mismatch'; end if;
  select curriculum_id into outcome_curriculum from public.curriculum_learning_outcomes where id = new.outcome_id;
  if not found then raise exception 'Outcome does not exist'; end if;
  if chapter_curriculum is not null and outcome_curriculum is not null and chapter_curriculum <> outcome_curriculum then raise exception 'Outcome curriculum mismatch'; end if;
  new.updated_at := now();
  return new;
end $$;

create function public.ce_validate_block_outcome_link()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare block_publication uuid; block_chapter uuid;
begin
  select publication_id, chapter_id into block_publication, block_chapter from public.content_blocks where id = new.content_block_id;
  if block_publication is null then raise exception 'Content block does not exist'; end if;
  if block_publication <> new.publication_id or block_chapter <> new.chapter_id then raise exception 'Content block publication/chapter mismatch'; end if;
  if not exists (select 1 from public.chapter_learning_outcome_links l where l.chapter_id = new.chapter_id and l.outcome_id = new.outcome_id) then raise exception 'Outcome must first be linked to chapter'; end if;
  return new;
end $$;

create function public.ce_sync_chapter_learning_outcomes(p_chapter_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.vibe_chapters%rowtype; item text; outcome_uuid uuid; seq integer := 0; caller uuid := auth.uid(); author_uuid uuid;
begin
  select * into c from public.vibe_chapters where id = p_chapter_id;
  if not found then raise exception 'Chapter does not exist'; end if;
  select author_id into author_uuid from public.vibe_publications where id = c.publication_id;
  if current_user not in ('postgres','service_role') and author_uuid is distinct from caller then raise exception 'Not authorized'; end if;

  delete from public.chapter_learning_outcome_links l
  using public.curriculum_learning_outcomes o
  where l.chapter_id = c.id and l.outcome_id = o.id and o.source_type = 'creator_claimed' and o.source_ref = 'chapter:' || c.id::text;

  foreach item in array c.learning_outcomes loop
    if nullif(btrim(item), '') is null then continue; end if;
    seq := seq + 1;
    insert into public.curriculum_learning_outcomes(curriculum_id, sub_strand_id, outcome_text, source_type, source_ref, status, created_by)
    values(c.curriculum_id, c.sub_strand_id, btrim(item), 'creator_claimed', 'chapter:' || c.id::text, 'draft', author_uuid)
    on conflict (
      coalesce(curriculum_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(sub_strand_id, '00000000-0000-0000-0000-000000000000'::uuid),
      lower(btrim(outcome_text)),
      source_type
    ) do update set updated_at = now()
    returning id into outcome_uuid;

    insert into public.chapter_learning_outcome_links(publication_id, chapter_id, outcome_id, alignment_strength, sequence, created_by)
    values(c.publication_id, c.id, outcome_uuid, 'supports', seq, author_uuid)
    on conflict(chapter_id, outcome_id) do update set sequence = excluded.sequence, updated_at = now();
  end loop;
  return seq;
end $$;

revoke all on function public.ce_sync_chapter_learning_outcomes(uuid) from public, anon;
grant execute on function public.ce_sync_chapter_learning_outcomes(uuid) to authenticated, service_role;

create function public.ce_sync_chapter_learning_outcomes_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.ce_sync_chapter_learning_outcomes(new.id);
  return new;
end $$;
revoke all on function public.ce_sync_chapter_learning_outcomes_trigger() from public, anon, authenticated;
grant execute on function public.ce_sync_chapter_learning_outcomes_trigger() to service_role;

create trigger ce_validate_chapter_outcome_link before insert or update on public.chapter_learning_outcome_links for each row execute function public.ce_validate_chapter_outcome_link();
create trigger ce_validate_block_outcome_link before insert or update on public.content_block_outcome_links for each row execute function public.ce_validate_block_outcome_link();
create trigger ce_sync_chapter_learning_outcomes after insert or update of learning_outcomes, curriculum_id, sub_strand_id on public.vibe_chapters for each row execute function public.ce_sync_chapter_learning_outcomes_trigger();

do $$
declare r record;
begin
  for r in select id from public.vibe_chapters where cardinality(learning_outcomes) > 0 loop
    perform public.ce_sync_chapter_learning_outcomes(r.id);
  end loop;
end $$;

insert into public.content_engine_authorities(domain, authoritative_table, authority_role, derived_tables, notes)
values
('learning_outcome','public.curriculum_learning_outcomes','Normalized curriculum learning-outcome authority',array['public.vibe_chapters.learning_outcomes','public.learner_outcomes'],'Creator chapter arrays are normalized as draft creator-claimed outcomes; verified official outcomes can later replace them without losing lineage.'),
('chapter_outcome_alignment','public.chapter_learning_outcome_links','Authoritative chapter-to-learning-outcome alignment',array['public.content_block_outcome_links'],'A content block may link only to an outcome already linked to its chapter.')
on conflict(domain) do update
set authoritative_table = excluded.authoritative_table,
    authority_role = excluded.authority_role,
    derived_tables = excluded.derived_tables,
    notes = excluded.notes,
    updated_at = now();

comment on table public.curriculum_learning_outcomes is 'CE-004 normalized learning outcomes used to ground content, lesson planning, exercises, projects and assessments.';
comment on table public.chapter_learning_outcome_links is 'CE-004 chapter-level curriculum alignment.';
comment on table public.content_block_outcome_links is 'CE-004 granular content-block to learning-outcome relationship.';

commit;
