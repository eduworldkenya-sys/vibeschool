begin;

create or replace function public.content_validate_textbook_publication(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_pub public.vibe_publications%rowtype;
  v_issue_count integer := 0;
  v_issues jsonb := '[]'::jsonb;
  v_chapter_count integer := 0;
  v_bad_chapters integer := 0;
  v_subject_matches integer := 0;
begin
  select * into v_pub
  from public.vibe_publications
  where id = p_publication_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'publication_id', p_publication_id,
      'issues', jsonb_build_array('publication_not_found')
    );
  end if;

  if v_pub.format <> 'vibetextbook' then
    v_issues := v_issues || jsonb_build_array('invalid_format');
  end if;

  if nullif(btrim(v_pub.title), '') is null then
    v_issues := v_issues || jsonb_build_array('missing_title');
  end if;

  if nullif(btrim(v_pub.description), '') is null then
    v_issues := v_issues || jsonb_build_array('missing_description');
  end if;

  if nullif(btrim(v_pub.curriculum_framework), '') is null then
    v_issues := v_issues || jsonb_build_array('missing_curriculum_framework');
  end if;

  if nullif(btrim(v_pub.cbc_grade), '') is null then
    v_issues := v_issues || jsonb_build_array('missing_level');
  end if;

  if nullif(btrim(v_pub.cbc_subject), '') is null then
    v_issues := v_issues || jsonb_build_array('missing_subject');
  else
    select count(*) into v_subject_matches
    from public.subjects s
    where s.school_id is null
      and lower(btrim(s.name)) = lower(btrim(v_pub.cbc_subject));

    if v_subject_matches = 0 then
      v_issues := v_issues || jsonb_build_array('subject_not_canonical');
    elsif v_subject_matches > 1 then
      v_issues := v_issues || jsonb_build_array('subject_identity_ambiguous');
    end if;
  end if;

  select count(*) into v_chapter_count
  from public.vibe_chapters c
  where c.publication_id = p_publication_id;

  if v_chapter_count = 0 then
    v_issues := v_issues || jsonb_build_array('missing_chapters');
  end if;

  select count(*) into v_bad_chapters
  from public.vibe_chapters c
  where c.publication_id = p_publication_id
    and (
      c.status <> 'published'
      or c.word_count <= 0
      or jsonb_typeof(c.blocks) <> 'array'
      or jsonb_array_length(c.blocks) = 0
      or coalesce(array_length(c.learning_outcomes, 1), 0) = 0
      or c.alignment_status not in ('verified', 'approved')
      or c.curriculum_id is null
      or c.sub_strand_id is null
    );

  if v_bad_chapters > 0 then
    v_issues := v_issues || jsonb_build_array('chapter_readiness_failed');
  end if;

  v_issue_count := jsonb_array_length(v_issues);

  return jsonb_build_object(
    'ok', v_issue_count = 0,
    'publication_id', p_publication_id,
    'chapter_count', v_chapter_count,
    'invalid_chapter_count', v_bad_chapters,
    'canonical_subject_matches', v_subject_matches,
    'issues', v_issues
  );
end;
$$;

revoke all on function public.content_validate_textbook_publication(uuid) from public, anon;
grant execute on function public.content_validate_textbook_publication(uuid) to authenticated, service_role;

create or replace function public.publish_textbook(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author_id uuid;
  v_format text;
  v_validation jsonb;
begin
  select author_id, format into v_author_id, v_format
  from public.vibe_publications
  where id = p_publication_id;

  if not found then
    raise exception 'Publication % not found', p_publication_id;
  end if;

  if v_format <> 'vibetextbook' then
    raise exception 'Publication % is format %, not vibetextbook', p_publication_id, v_format;
  end if;

  if auth.uid() is distinct from v_author_id then
    raise exception 'Not authorized to publish publication %', p_publication_id;
  end if;

  v_validation := public.content_validate_textbook_publication(p_publication_id);
  if coalesce((v_validation ->> 'ok')::boolean, false) is not true then
    raise exception 'Publication % is not pilot-ready: %', p_publication_id, v_validation -> 'issues';
  end if;

  update public.vibe_publications
  set status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = p_publication_id;

  return query select * from public.sync_vibelearn_textbook_index(p_publication_id);
end;
$$;

revoke all on function public.publish_textbook(uuid) from public, anon;
grant execute on function public.publish_textbook(uuid) to authenticated;

comment on function public.content_validate_textbook_publication(uuid) is
'Task 20 fail-closed readiness validator. A vibetextbook cannot be treated as pilot-ready unless curriculum level, canonical platform subject, chapters, outcomes, curriculum/sub-strand identity and approved/verified alignment are present.';

comment on function public.publish_textbook(uuid) is
'Author-only textbook publication gateway. Task 20 requires content_validate_textbook_publication() to pass before lifecycle publication and VibeLearn reconciliation.';

commit;
