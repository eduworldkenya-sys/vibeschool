-- Lesson journey authority convergence
--
-- This migration intentionally does not rewrite legacy partial Scheme rows.
-- Existing incomplete rows require confirmed canonical curriculum enrichment
-- before they can be repaired honestly. Instead, it closes the write paths so
-- future canonical curriculum Scheme rows cannot persist incomplete planning
-- fields or activity-only lesson titles.

create or replace function public.scheme_lesson_title_is_instructional(
  p_title text
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_normalized text;
  v_first_word text;
  v_word_count integer;
begin
  if v_title = '' then
    return false;
  end if;

  v_normalized := lower(
    regexp_replace(v_title, '[^[:alnum:]''-]+', ' ', 'g')
  );
  v_normalized := btrim(v_normalized);

  if v_normalized = '' then
    return false;
  end if;

  v_word_count := cardinality(
    regexp_split_to_array(v_normalized, '\s+')
  );
  v_first_word := split_part(v_normalized, ' ', 1);

  -- Short imperative/activity labels belong in learning experiences, not in
  -- the lesson title. This catches defects such as "Locate and investigate",
  -- "Demonstrate mastery", "Discuss", and "Compare and report" while allowing
  -- content-bearing titles such as "Investigating Traditional Government in
  -- Buganda" or "Comparison of Traditional Governance Systems".
  if v_word_count <= 4 and v_first_word = any(array[
    'locate', 'investigate', 'identify', 'discuss', 'compare', 'demonstrate',
    'explore', 'observe', 'research', 'review', 'practise', 'practice', 'apply',
    'analyse', 'analyze', 'evaluate', 'describe', 'explain', 'draw', 'list',
    'state', 'show', 'find', 'match', 'sort', 'classify', 'complete', 'answer',
    'read', 'write', 'present', 'debate', 'roleplay', 'role-play'
  ]) then
    return false;
  end if;

  return true;
end;
$$;

revoke execute on function public.scheme_lesson_title_is_instructional(text)
  from public, anon, authenticated;

create or replace function public.guard_curriculum_content_lesson_title_quality()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.scheme_lesson_title_is_instructional(new.title) then
    raise exception 'SCHEME_LESSON_TITLE_TOO_GENERIC'
      using errcode = 'P0001',
            detail = 'A canonical lesson title must identify the learning content. Put activity instructions under learning experiences.';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_curriculum_content_lesson_title_quality()
  from public, anon, authenticated;

drop trigger if exists trg_curriculum_content_lesson_title_quality
  on public.curriculum_content_lesson_versions;

create trigger trg_curriculum_content_lesson_title_quality
before insert or update of title
on public.curriculum_content_lesson_versions
for each row
execute function public.guard_curriculum_content_lesson_title_quality();

create or replace function public.guard_curriculum_scheme_instructional_completeness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source = 'curriculum' and new.curriculum_id is not null then
    if btrim(coalesce(new.objectives, '')) = ''
       or btrim(coalesce(new.key_inquiry_question, '')) = ''
       or btrim(coalesce(new.learning_resources, '')) = ''
       or btrim(coalesce(new.learning_experiences, '')) = ''
       or btrim(coalesce(new.assessment_methods, '')) = '' then
      raise exception 'SCHEME_CURRICULUM_ENRICHMENT_REQUIRED'
        using errcode = 'P0001',
              detail = 'Curriculum-derived Scheme lessons require objectives, key inquiry question, learning resources, learning experiences and assessment methods from confirmed authority.';
    end if;

    if not public.scheme_lesson_title_is_instructional(new.topic) then
      raise exception 'SCHEME_LESSON_TITLE_TOO_GENERIC'
        using errcode = 'P0001',
              detail = 'A Scheme lesson topic must name the learning content; activity instructions belong under learning experiences.';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_curriculum_scheme_instructional_completeness()
  from public, anon, authenticated;

-- INSERT is always guarded. UPDATE is intentionally limited to the fields
-- that define instructional content so existing legacy partial rows can still
-- move through independent delivery/coverage lifecycle updates without being
-- silently rewritten or permanently locked.
drop trigger if exists trg_curriculum_scheme_instructional_completeness
  on public.scheme_of_work;

create trigger trg_curriculum_scheme_instructional_completeness
before insert or update of
  topic,
  objectives,
  key_inquiry_question,
  learning_resources,
  learning_experiences,
  assessment_methods
on public.scheme_of_work
for each row
execute function public.guard_curriculum_scheme_instructional_completeness();
