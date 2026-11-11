-- Grade 9 English native KICD-aligned *heading index*, October 2024 revision.
-- Source: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/
-- No official learning-outcome text is copied; no claims of KICD verification.
-- Preserve legacy rows and school/teacher-created scheme records in full.
-- Term and week are intentionally NULL: school pacing is teacher-specific.
begin;
create temporary table _g9_en_index (
  code text primary key,
  strand text not null,
  title text not null,
  theme integer not null,
  lane integer not null
) on commit drop;
insert into _g9_en_index(code,strand,title,theme,lane)
select x.code,x.strand,x.title,x.theme,x.lane
from jsonb_to_recordset($grade9_english$[{"code":"1.1.1","strand":"Listening and Speaking","title":"Polite language: euphemism","theme":1,"lane":1},{"code":"1.2.1","strand":"Reading","title":"Independent reading: appropriate texts","theme":1,"lane":2},{"code":"1.3.1","strand":"Grammar in Use","title":"Gender-neutral language","theme":1,"lane":3},{"code":"1.4.1","strand":"Reading","title":"Class reader: structure and setting","theme":1,"lane":4},{"code":"1.5.1","strand":"Writing","title":"Legibility and neatness","theme":1,"lane":5},{"code":"2.1.1","strand":"Listening and Speaking","title":"Oral literature: short forms","theme":2,"lane":1},{"code":"2.2.1","strand":"Reading","title":"Intensive reading: simple poems","theme":2,"lane":2},{"code":"2.3.1","strand":"Grammar in Use","title":"Nouns and quantifiers","theme":2,"lane":3},{"code":"2.4.1","strand":"Reading","title":"Class reader: plot","theme":2,"lane":4},{"code":"2.5.1","strand":"Writing","title":"Punctuation marks","theme":2,"lane":5},{"code":"3.1.1","strand":"Listening and Speaking","title":"Listening comprehension: main ideas and details","theme":3,"lane":1},{"code":"3.2.1","strand":"Reading","title":"Reading for information and meaning","theme":3,"lane":2},{"code":"3.3.1","strand":"Grammar in Use","title":"Modal auxiliaries","theme":3,"lane":3},{"code":"3.4.1","strand":"Reading","title":"Poems: structure","theme":3,"lane":4},{"code":"3.5.1","strand":"Writing","title":"Paragraph structure","theme":3,"lane":5},{"code":"4.1.1","strand":"Listening and Speaking","title":"Selective listening","theme":4,"lane":1},{"code":"4.2.1","strand":"Reading","title":"Intensive reading: key events","theme":4,"lane":2},{"code":"4.3.1","strand":"Grammar in Use","title":"Present and past perfect aspect","theme":4,"lane":3},{"code":"4.4.1","strand":"Reading","title":"Class reader: characters","theme":4,"lane":4},{"code":"4.5.1","strand":"Writing","title":"Narrative and descriptive paragraphs","theme":4,"lane":5},{"code":"5.1.1","strand":"Listening and Speaking","title":"Pronunciation","theme":5,"lane":1},{"code":"5.2.1","strand":"Reading","title":"Reference materials","theme":5,"lane":2},{"code":"5.3.1","strand":"Grammar in Use","title":"Order of adjectives","theme":5,"lane":3},{"code":"5.4.1","strand":"Reading","title":"Class reader: style","theme":5,"lane":4},{"code":"5.5.1","strand":"Writing","title":"Letter of application","theme":5,"lane":5},{"code":"6.1.1","strand":"Listening and Speaking","title":"Conversational skills: negotiation","theme":6,"lane":1},{"code":"6.2.1","strand":"Reading","title":"Reading fluency","theme":6,"lane":2},{"code":"6.3.1","strand":"Grammar in Use","title":"Comparison of adverbs","theme":6,"lane":3},{"code":"6.4.1","strand":"Reading","title":"Class reader: themes","theme":6,"lane":4},{"code":"6.5.1","strand":"Writing","title":"Spelling","theme":6,"lane":5},{"code":"7.1.1","strand":"Listening and Speaking","title":"Listening for details","theme":7,"lane":1},{"code":"7.2.1","strand":"Reading","title":"Interpretation and evaluation","theme":7,"lane":2},{"code":"7.3.1","strand":"Grammar in Use","title":"Relative and interrogative pronouns","theme":7,"lane":3},{"code":"7.4.1","strand":"Reading","title":"Class reader: character study","theme":7,"lane":4},{"code":"7.5.1","strand":"Writing","title":"Writing process: steps","theme":7,"lane":5},{"code":"8.1.1","strand":"Listening and Speaking","title":"Oral poetry","theme":8,"lane":1},{"code":"8.2.1","strand":"Reading","title":"Reading for interpretation","theme":8,"lane":2},{"code":"8.3.1","strand":"Grammar in Use","title":"Complex prepositions","theme":8,"lane":3},{"code":"8.4.1","strand":"Reading","title":"Poetry: characters","theme":8,"lane":4},{"code":"8.5.1","strand":"Writing","title":"Assessing writing","theme":8,"lane":5},{"code":"9.1.1","strand":"Listening and Speaking","title":"Diphthongs and sentence stress","theme":9,"lane":1},{"code":"9.2.1","strand":"Reading","title":"Extensive reading: fiction","theme":9,"lane":2},{"code":"9.3.1","strand":"Grammar in Use","title":"Correlative conjunctions","theme":9,"lane":3},{"code":"9.4.1","strand":"Reading","title":"Class reader: style","theme":9,"lane":4},{"code":"9.5.1","strand":"Writing","title":"Narrative composition","theme":9,"lane":5},{"code":"10.1.1","strand":"Listening and Speaking","title":"Impromptu speeches","theme":10,"lane":1},{"code":"10.2.1","strand":"Reading","title":"Study skills: note making","theme":10,"lane":2},{"code":"10.3.1","strand":"Grammar in Use","title":"Numerals and ordinals","theme":10,"lane":3},{"code":"10.4.1","strand":"Reading","title":"Class reader: play project","theme":10,"lane":4},{"code":"10.5.1","strand":"Writing","title":"Completing application forms","theme":10,"lane":5},{"code":"11.1.1","strand":"Listening and Speaking","title":"Job interview conversations","theme":11,"lane":1},{"code":"11.2.1","strand":"Reading","title":"Extensive reading: fiction","theme":11,"lane":2},{"code":"11.3.1","strand":"Grammar in Use","title":"Nouns","theme":11,"lane":3},{"code":"11.4.1","strand":"Reading","title":"Class reader: lessons learnt","theme":11,"lane":4},{"code":"11.5.1","strand":"Writing","title":"Abbreviations and acronyms","theme":11,"lane":5},{"code":"12.1.1","strand":"Listening and Speaking","title":"Listening and responding: feelings","theme":12,"lane":1},{"code":"12.2.1","strand":"Reading","title":"Comprehension strategies","theme":12,"lane":2},{"code":"12.3.1","strand":"Grammar in Use","title":"Phrasal verbs","theme":12,"lane":3},{"code":"12.4.1","strand":"Reading","title":"Class reader: characterisation","theme":12,"lane":4},{"code":"12.5.1","strand":"Writing","title":"Writing process","theme":12,"lane":5},{"code":"13.1.1","strand":"Listening and Speaking","title":"Extensive listening: speeches","theme":13,"lane":1},{"code":"13.2.1","strand":"Reading","title":"Visualising and summarising","theme":13,"lane":2},{"code":"13.3.1","strand":"Grammar in Use","title":"Complex sentences","theme":13,"lane":3},{"code":"13.4.1","strand":"Reading","title":"Class reader: style","theme":13,"lane":4},{"code":"13.5.1","strand":"Writing","title":"Creative writing with idioms","theme":13,"lane":5},{"code":"14.1.1","strand":"Listening and Speaking","title":"Intonation in question tags","theme":14,"lane":1},{"code":"14.2.1","strand":"Reading","title":"Summarising argumentative texts","theme":14,"lane":2},{"code":"14.3.1","strand":"Grammar in Use","title":"Direct and indirect speech","theme":14,"lane":3},{"code":"14.4.1","strand":"Reading","title":"Relating characters and themes to life","theme":14,"lane":4},{"code":"14.5.1","strand":"Writing","title":"Descriptive writing","theme":14,"lane":5},{"code":"15.1.1","strand":"Listening and Speaking","title":"Oral news reporting","theme":15,"lane":1},{"code":"15.2.1","strand":"Reading","title":"Reading fluency","theme":15,"lane":2},{"code":"15.3.1","strand":"Grammar in Use","title":"Imperatives and exclamatory sentences","theme":15,"lane":3},{"code":"15.4.1","strand":"Reading","title":"Intensive reading: poems","theme":15,"lane":4},{"code":"15.5.1","strand":"Writing","title":"Emails","theme":15,"lane":5}]$grade9_english$::jsonb)
as x(code text,strand text,title text,theme integer,lane integer);

do $grade9_en$
declare
  v_subject uuid;
  v_total integer;
begin
  select id into strict v_subject
  from public.subjects where school_id is null and name='English';
  if (select count(*) from _g9_en_index) <> 75
    or (select count(distinct theme) from _g9_en_index) <> 15
    or exists(select 1 from _g9_en_index where theme not between 1 and 15 or lane not between 1 and 5
      or code <> theme::text||'.'||lane::text||'.1')
  then raise exception 'GRADE9_ENGLISH_SOURCE_INDEX_INCOMPLETE'; end if;

  -- Index-only: creator-friendly headings are not official outcome claims.
  insert into public.cbc_strands
    (subject_id,grade,name,sub_strand,strand_order,sub_strand_order,source_ref)
  select v_subject,'Grade 9',strand,code||' · '||title,
    case when lane=4 then 2 when lane=5 then 4 else lane end,
    (theme-1)*5+lane,
    'VS-REF-G09-EN-2024#'||code
  from _g9_en_index
  on conflict (subject_id,grade,name,sub_strand) do nothing;

  select count(*) into v_total from public.cbc_strands
  where subject_id=v_subject and grade='Grade 9'
    and source_ref like 'VS-REF-G09-EN-2024#%';
  if v_total <> 75 then
    raise exception 'GRADE9_ENGLISH_INDEX_REGISTRATION_INCOMPLETE: %',v_total;
  end if;
end
$grade9_en$;
commit;
