-- Grade 4 English 11.4.1 editorial alignment with KICD revised 2024,
-- printed page 74 / PDF page 84: Writing / Spelling / Commonly Misspelt Words.
-- This is a VibeSchool-original, creator_claimed curriculum correction,
-- NOT an official authority snapshot/promotion or KICD approval.
-- The 3 legacy outcome identities are preserved as archived records.
-- No school Scheme, teacher plan, timetable, teaching history, learner
-- evidence, publication, resource or exam attempt is altered.
begin;

do $reconcile$
declare
  v_unit uuid;
  v_expected integer;
  v_updated integer;
  v_rows integer;
  v_reference record;
  v_in_use boolean;
begin
  select id into v_unit
    from public.cbc_strands
   where source_ref='VS-CUR-G04-EN-2026#11-WR'
     and grade='Grade 4'
     and name='Writing'
     and sub_strand='Sports: My Favourite Game: Mechanics of Writing — Commonly Misspelt Words';
  if v_unit is null then raise exception 'GRADE4_SPELLING_SOURCE_UNIT_MISSING'; end if;

  select count(*) into v_expected from public.curriculum_learning_outcomes
   where sub_strand_id=v_unit and source_type='creator_claimed' and status='active'
     and outcome_code in ('VS-G4-EN-11-WR-01','VS-G4-EN-11-WR-02','VS-G4-EN-11-WR-03')
     and source_ref in ('VS-CUR-G04-EN-2026#11-WR/1',
                        'VS-CUR-G04-EN-2026#11-WR/2',
                        'VS-CUR-G04-EN-2026#11-WR/3');
  if v_expected<>3 or
    (select count(*) from public.curriculum_learning_outcomes
      where sub_strand_id=v_unit and status='active')<>3
  then raise exception 'GRADE4_SPELLING_LEGACY_STATE_CHANGED'; end if;

  -- Inspect every existing FK to the canonical outcome table, including
  -- future resource, learner-evidence and authority tables. The reference
  -- scan fails closed if any legacy outcome is already in use.
  for v_reference in
    select c.conrelid::regclass::text as referring_table,
           att.attname as referring_column
      from pg_constraint c
      join pg_attribute att on att.attrelid=c.conrelid
                           and att.attnum=c.conkey[1]
     where c.contype='f'
       and c.confrelid='public.curriculum_learning_outcomes'::regclass
  loop
    execute format(
      'select exists(select 1 from %s t join public.curriculum_learning_outcomes o
        on o.id=t.%I where o.sub_strand_id=$1 and o.status=''active'')',
      v_reference.referring_table,
      v_reference.referring_column
    ) into v_in_use using v_unit;
    if v_in_use then
      raise exception 'GRADE4_SPELLING_HISTORY_REQUIRES_AUTHORIZED_REVIEW: %.%',
        v_reference.referring_table, v_reference.referring_column;
    end if;
  end loop;

  update public.curriculum_learning_outcomes
     set status='archived',updated_at=now()
   where sub_strand_id=v_unit and status='active'
     and source_type='creator_claimed'
     and outcome_code in ('VS-G4-EN-11-WR-01','VS-G4-EN-11-WR-02','VS-G4-EN-11-WR-03');
  get diagnostics v_updated=row_count;
  if v_updated<>3 then raise exception 'GRADE4_SPELLING_ARCHIVE_COUNT_MISMATCH'; end if;

  -- New identities avoid silently repurposing earlier educational records.
  -- All three remain creator_claimed, not verified or official.
  insert into public.curriculum_learning_outcomes
      (sub_strand_id,outcome_code,outcome_text,source_type,source_ref,source_locator,status)
  values
      (v_unit,'VS-G4-EN-11-WR-04',
       'Notice commonly misspelt words when listening to sentences and reading short texts about sports; explain which written form makes sense in context.',
       'creator_claimed','VS-CUR-G04-EN-2026#11-WR/4',
       'KICD Grade 4 English Language, revised 2024, theme 11, 11.4.1, printed p.74 (PDF p.84)', 'active'),
      (v_unit,'VS-G4-EN-11-WR-05',
       'Spell selected words correctly from dictation and use them in clear, original sentences about favourite games, checking and correcting mistakes.',
       'creator_claimed','VS-CUR-G04-EN-2026#11-WR/5',
       'KICD Grade 4 English Language, revised 2024, theme 11, 11.4.1, printed p.74 (PDF p.84)', 'active'),
      (v_unit,'VS-G4-EN-11-WR-06',
       'Review the spelling in a short piece of writing, explain how corrections make the message easier to understand, and practise careful spelling.',
       'creator_claimed','VS-CUR-G04-EN-2026#11-WR/6',
       'KICD Grade 4 English Language, revised 2024, theme 11, 11.4.1, printed p.74 (PDF p.84)', 'active');
  get diagnostics v_rows=row_count;
  if v_rows<>3 then raise exception 'GRADE4_SPELLING_NEW_OUTCOME_COUNT_MISMATCH'; end if;

  -- Source says two lessons; this is sub-strand guidance only, NOT an
  -- automatic change to any school-selected five-period weekly plan.
  update public.curriculum_unit_guidance
     set suggested_lessons=2,
         learning_resources='Teacher dictation sentences, exercise books, original sports word cards and optional paper word puzzle.',
         assessment_methods='Observe a contextual spelling choice, mark independent dictation and short written sentences, and ask learners to explain one correction.',
         competencies='Critical thinking and problem solving; learning to learn; communication and collaboration.',
         updated_at=now()
   where sub_strand_id=v_unit and content_status='active'
     and suggested_lessons=3;
  get diagnostics v_updated=row_count;
  if v_updated<>1 then raise exception 'GRADE4_SPELLING_LESSON_ALLOCATION_UNEXPECTED'; end if;

  update public.grade4_english_reader_bindings
     set key_inquiry_questions=array[
           'Why do we sometimes spell familiar words incorrectly?',
           'How can checking meaning and spelling make our writing clearer?'],
         suggested_experiences=array[
           'Listen to a short sports-themed dictation, write selected words, then compare the spelling with a model.',
           'Use sentences to explain the correct word, form jumbled words and correct mistakes in exercise books with peer feedback.']
   where source_ref='VS-CUR-G04-EN-2026#11-WR'
     and sub_strand_id=v_unit and status='active';
  get diagnostics v_updated=row_count;
  if v_updated<>1 then raise exception 'GRADE4_SPELLING_READER_LINK_UNEXPECTED'; end if;

  if (select count(*) from public.curriculum_learning_outcomes
       where sub_strand_id=v_unit and source_type='creator_claimed' and status='active')<>3
     or (select count(*) from public.curriculum_learning_outcomes
       where sub_strand_id=v_unit and source_type='creator_claimed' and status='archived')<>3
  then raise exception 'GRADE4_SPELLING_FINAL_IDENTITY_CHECK_FAILED'; end if;
end
$reconcile$;
commit;
