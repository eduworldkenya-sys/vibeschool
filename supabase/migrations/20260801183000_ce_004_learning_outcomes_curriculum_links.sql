begin;

-- Historical duplicate of the canonical CE-004 schema migration at
-- 20260801143019_ce_004_learning_outcomes_curriculum_links.sql.
-- Keep this timestamp in the migration ledger, but do not recreate objects
-- that already exist during a blank-database replay.
--
-- The later CE-004 implementation originally repeated the same tables,
-- indexes, policies and authority rows and then added synchronization
-- functions/triggers. The canonical migration already owns the schema.
-- This migration therefore installs only the additional synchronization
-- behaviour, using replace/drop guards so replay is deterministic.

create or replace function public.ce_validate_chapter_outcome_link()
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

create or replace function public.ce_validate_block_outcome_link()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare block_publication uuid; block_chapter uuid;
begin
  select publication_id, chapter_id into block_publication, block_chapter from public.content_blocks where id = new.content_block_id;
  if block_publication is null then raise exception 'Content block does not exist'; end if;
  if block_publication <> new.publication_id or block_chapter <> new.chapter_id then raise exception 'Content block publication/chapter mismatch'; end if;
  if not exists (select 1 from public.chapter_learning_outcome_links l where l.chapter_id = new.chapter_id and l.outcome_id = new.outcome_id) then raise exception 'Outcome must first be linked to chapter'; end if;
  return new;
end $$;

create or replace function public.ce_sync_chapter_learning_outcomes(p_chapter_id uuid)
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

create or replace function public.ce_sync_chapter_learning_outcomes_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.ce_sync_chapter_learning_outcomes(new.id);
  return new;
end $$;
revoke all on function public.ce_sync_chapter_learning_outcomes_trigger() from public, anon, authenticated;
grant execute on function public.ce_sync_chapter_learning_outcomes_trigger() to service_role;

drop trigger if exists ce_validate_chapter_outcome_link on public.chapter_learning_outcome_links;
create trigger ce_validate_chapter_outcome_link before insert or update on public.chapter_learning_outcome_links for each row execute function public.ce_validate_chapter_outcome_link();
drop trigger if exists ce_validate_block_outcome_link on public.content_block_outcome_links;
create trigger ce_validate_block_outcome_link before insert or update on public.content_block_outcome_links for each row execute function public.ce_validate_block_outcome_link();
drop trigger if exists ce_sync_chapter_learning_outcomes on public.vibe_chapters;
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
