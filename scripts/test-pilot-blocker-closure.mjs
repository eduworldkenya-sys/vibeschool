import assert from 'node:assert/strict'
import fs from 'node:fs'

const schemeRepair = fs.readFileSync(
  'supabase/migrations/20261010180500_repair_custom_scheme_generated_content_status.sql',
  'utf8',
)

const normalized = schemeRepair.toLowerCase().replace(/\s+/g, ' ')
const insert = normalized.match(/insert into public\.scheme_of_work\s*\(([^)]*)\)/)

assert.ok(insert, 'custom Scheme repair must keep the canonical scheme_of_work writer')
assert.ok(
  !insert[1].split(',').map((column) => column.trim()).includes('content_status'),
  'custom Scheme writer must not write the generated content_status column',
)
assert.match(normalized, /security definer set search_path = ''/)
assert.match(normalized, /scheme_assignment_required/)
assert.match(normalized, /scheme_week_not_in_instructional_calendar/)
assert.match(normalized, /revoke all on function public\.commit_custom_scheme_item/)
assert.match(normalized, /from public, anon/)
assert.match(normalized, /grant execute on function public\.commit_custom_scheme_item/)
assert.match(normalized, /to authenticated/)

const priorWriter = fs.readFileSync(
  'supabase/migrations/20260901091000_scheme_calendar_subject_and_custom_authority.sql',
  'utf8',
)
assert.match(
  priorWriter,
  /topic,status,source,content_status,sequence_number/,
  'regression test must prove the historical generated-column failure remains represented',
)

const attendance = fs.readFileSync('app/teacher/attendance/page.tsx', 'utf8')
assert.match(attendance, /existing\[student\.id\] \?\? "unmarked"/)
assert.match(attendance, /Mark all \$\{unmarked\.length\} remaining learner/)
assert.match(attendance, /disabled=\{saving \|\| unmarkedCount > 0\}/)
assert.match(attendance, />Adm\. \{student\.admissionNumber\}</)
assert.doesNotMatch(attendance, /statuses\[student\.id\] \?\? "present"/)

const homework = fs.readFileSync('app/teacher/classhub/[id]/homework/page.tsx', 'utf8')
assert.match(homework, /setDraftReady\(false\)/)
assert.match(homework, /setDraftReady\(true\)/)
assert.match(homework, /draftReady && showForm && context\?\.school_id/)
assert.match(homework, /disabled=\{saving \|\| !formValid\}/)
assert.match(homework, /Choose when learners should submit\./)
assert.match(homework, /aria-invalid=\{Boolean\(fieldErrors\.dueDate\)\}/)

const lessonPlansAlias = fs.readFileSync('app/teacher/lesson-plans/page.tsx', 'utf8')
assert.match(lessonPlansAlias, /redirect\("\/teacher\/lessonplan"\)/)

const schemePage = fs.readFileSync('app/teacher/scheme/AuthoritySchemePage.jsx', 'utf8')
assert.match(schemePage, /if\(r\.error\)setError\(commitError\(r\.error\.message\)\)/)
assert.match(schemePage, /Choose a week from this term’s instructional calendar\./)
assert.match(schemePage, /Your entries are still here/)

const schoolHub = fs.readFileSync('app/teacher/schoolhub/page.tsx', 'utf8')
assert.doesNotMatch(schoolHub, /console\.error\('\[SchoolHub\] information enrichment failed'/)

const studioTokens = fs.readFileSync('components/teacher/studio-tokens.ts', 'utf8')
const studioCss = fs.readFileSync('components/teacher/studio.css', 'utf8')
assert.match(studioTokens, /--teacher-accent, #087451/)
assert.match(studioCss, /--teacher-accent:#087451/)
assert.match(studioCss, /\.teacher-class-card \{[^}]*background:var\(--teacher-surface\)/)
assert.doesNotMatch(studioCss, /\.teacher-class-card:first-child \{background:/)
assert.doesNotMatch(studioCss, /\.teacher-class-card:nth-child/)

console.log('pilot blocker closure contract: PASS')

const pgliteModule = process.env.PILOT_PGLITE_MODULE || '@electric-sql/pglite'
const { PGlite } = await import(pgliteModule)
const db = new PGlite()
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const teacher = uuid(1)
const school = uuid(2)
const classId = uuid(3)
const subjectId = uuid(4)
const termId = uuid(5)

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create function public.is_school_admin(uuid) returns boolean language sql stable as $$select false$$;

    create table public.classes(id uuid primary key, school_id uuid not null, name text not null);
    create table public.subjects(id uuid primary key, school_id uuid, global_subject_id uuid, name text not null);
    create table public.academic_terms(id uuid primary key, school_id uuid not null, term integer not null);
    create table public.teacher_classes(teacher_id uuid, school_id uuid, class_id uuid, subject_id uuid);
    create table public.term_weeks(term_id uuid, school_id uuid, week_number integer);
    create table public.learning_resources(id uuid primary key, status text, publication_id uuid, chapter_id uuid);
    create table public.class_resource_library(teacher_id uuid, school_id uuid, class_id uuid, subject_id uuid, resource_id uuid, status text);
    create table public.scheme_of_work(
      id uuid primary key default gen_random_uuid(), school_id uuid, teacher_id uuid,
      class_id uuid, subject_id uuid, curriculum_id uuid, curriculum_content_id uuid,
      academic_term_id uuid, curriculum_type text, grade text, subject text, term integer,
      week integer, strand text, sub_strand text, topic text, objectives text,
      key_inquiry_question text, status text, source text, sequence_number integer,
      content_status text generated always as (
        case when objectives is not null and key_inquiry_question is not null then 'complete'
          when objectives is not null or key_inquiry_question is not null then 'partial'
          else 'missing' end
      ) stored
    );
    create table public.scheme_lesson_resource_links(
      scheme_lesson_id uuid, publication_id uuid, chapter_id uuid, resource_id uuid,
      resource_role text, sequence integer, exercise_refs jsonb, created_by uuid
    );
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    grant select on public.scheme_of_work to authenticated;

    insert into public.classes values ('${classId}', '${school}', 'Grade 10');
    insert into public.subjects values ('${subjectId}', '${school}', null, 'English');
    insert into public.academic_terms values ('${termId}', '${school}', 3);
    insert into public.teacher_classes values ('${teacher}', '${school}', '${classId}', '${subjectId}');
    insert into public.term_weeks values ('${termId}', '${school}', 7);
  `)
  await db.exec(schemeRepair)
  await db.exec(`set request.jwt.claim.sub='${teacher}'; set role authenticated`)
  const saved = (await db.query(
    'select saved.* from public.commit_custom_scheme_item($1,$2,$3,7,$4,$5,null,null) saved',
    [classId, subjectId, termId, 'Functional writing', 'Writing'],
  )).rows[0]
  assert.equal(saved.topic, 'Functional writing')
  assert.equal(saved.content_status, 'missing')
  assert.equal(
    (await db.query('select count(*)::int count from public.scheme_of_work')).rows[0].count,
    1,
    'valid custom Scheme item persists once',
  )

  await assert.rejects(
    () => db.query(
      'select public.commit_custom_scheme_item($1,$2,$3,99,$4,null,null,null)',
      [classId, subjectId, termId, 'Outside calendar'],
    ),
    /SCHEME_WEEK_NOT_IN_INSTRUCTIONAL_CALENDAR/,
  )
  await db.exec(`reset role; set request.jwt.claim.sub='${uuid(99)}'; set role authenticated`)
  await assert.rejects(
    () => db.query(
      'select public.commit_custom_scheme_item($1,$2,$3,7,$4,null,null,null)',
      [classId, subjectId, termId, 'Unauthorized lesson'],
    ),
    /SCHEME_ASSIGNMENT_REQUIRED/,
  )
  await db.exec("reset role; set request.jwt.claim.sub=''; set role anon")
  await assert.rejects(
    () => db.query(
      'select public.commit_custom_scheme_item($1,$2,$3,7,$4,null,null,null)',
      [classId, subjectId, termId, 'Anonymous lesson'],
    ),
    /permission denied/,
  )
  console.log('pilot Scheme database regression: PASS')
} finally {
  await db.close()
}
