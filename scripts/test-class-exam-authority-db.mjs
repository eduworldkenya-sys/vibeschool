/**
 * CBC class-exam authority: run the real proposed migration in an isolated
 * ephemeral PGlite database, with explicitly minimal baseline fixtures.
 * Never connects to production. Fixture is not a full migration rebuild.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.EXAM_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
await db.exec(`
create role authenticated;
create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table profiles(id uuid primary key, account_status text not null, is_anonymized boolean not null default false);
create table schools(id uuid primary key);
create table classes(id uuid primary key, school_id uuid references schools(id));
create table subjects(id uuid primary key, name text, school_id uuid);
create table school_members(profile_id uuid, school_id uuid, role text not null);
create table teacher_classes(teacher_id uuid, school_id uuid, class_id uuid, subject_id uuid, is_class_teacher boolean not null default false);
create table students(id uuid primary key, name text, admission_number text, deleted_at timestamptz, profile_id uuid);
create table student_classes(school_id uuid, class_id uuid, student_id uuid, is_current boolean);
create table parent_student_links(parent_id uuid,student_id uuid);
create table report_card_remarks(id uuid primary key default gen_random_uuid(),
 exam_id uuid,school_id uuid,class_id uuid,student_id uuid,class_teacher_id uuid,
 remarks text,conduct text);
create table exams(id uuid primary key, school_id uuid, name text, is_locked boolean not null default false, pass_mark int not null default 50);
create table exam_subject_config(exam_id uuid, subject_id uuid, max_marks numeric not null, pass_mark numeric not null, primary key(exam_id, subject_id));
create table exam_results(
 id uuid primary key default gen_random_uuid(),
 exam_id uuid not null, school_id uuid not null, class_id uuid not null,
 subject_id uuid not null, student_id uuid not null, teacher_id uuid not null,
 marks numeric, is_absent boolean not null default false,
 result_state text not null default 'entered', max_marks numeric not null default 100,
 percentage numeric generated always as (
   case when result_state='entered' and marks is not null and max_marks>0
   then round((marks/max_marks)*100,2) else null end
 ) stored,
 created_at timestamptz default now(), updated_at timestamptz not null default now(),
 unique (exam_id,student_id,subject_id),
 check ((result_state='entered' and marks is not null and marks>=0 and marks<=max_marks)
 or (result_state<>'entered' and marks is null))
);
create function fixture_exam_updated_at() returns trigger language plpgsql as
 $$ begin new.updated_at = clock_timestamp(); return new; end $$;
create trigger exam_results_updated_at before update on exam_results
for each row execute function fixture_exam_updated_at();
create table platform_events(id uuid primary key default gen_random_uuid(),
 event_type text not null, actor_id uuid, school_id uuid, entity_type text not null,
 entity_id uuid, metadata jsonb not null default '{}'::jsonb, idempotency_key text);
create function public.teacher_get_operating_context(p_requested_school_id uuid default null)
 returns jsonb language sql stable security definer set search_path = '' as
 $$ select jsonb_build_object('school_id', nullif(current_setting('request.active_school', true),'')) $$;
create function public.is_school_admin(p_school_id uuid) returns boolean
language sql stable security definer set search_path='' as
$$ select auth.uid() is not null and exists(select 1 from public.school_members sm
  where sm.profile_id=auth.uid() and sm.school_id=p_school_id and sm.role='admin') $$;
create function public.is_live_teacher_subject(
 p_school_id uuid, p_class_id uuid, p_subject_id uuid
) returns boolean language sql stable security definer set search_path = '' as
 $$ select auth.uid() is not null and exists(
 select 1 from public.teacher_classes tc
 join public.school_members sm on sm.profile_id=tc.teacher_id
 and sm.school_id=tc.school_id and sm.role='teacher'
 where tc.teacher_id=auth.uid() and tc.school_id=p_school_id and tc.class_id=p_class_id
 and (p_subject_id is null or tc.subject_id=p_subject_id)
 ) $$;
grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant select, update on exam_results to authenticated;
grant select on student_classes, students, parent_student_links, report_card_remarks to authenticated;
alter table report_card_remarks enable row level security;
alter table exam_results enable row level security;
create policy "Teachers view exam results for their classes" on exam_results for select to authenticated
 using (public.is_live_teacher_subject(school_id,class_id,subject_id));
create policy old_subject_edit on exam_results for update to authenticated
 using (teacher_id=auth.uid() and public.is_live_teacher_subject(school_id,class_id,subject_id))
 with check (teacher_id=auth.uid() and public.is_live_teacher_subject(school_id,class_id,subject_id));
`);
async function root(q) { await db.exec('reset role'); return db.exec(q); }
await root(`
insert into schools values ('${id(10)}'),('${id(11)}');
insert into classes values ('${id(20)}','${id(10)}'),('${id(21)}','${id(10)}'),('${id(22)}','${id(11)}');
insert into subjects values ('${id(90)}','Maths','${id(10)}'),('${id(91)}','English','${id(10)}'),('${id(92)}','Science','${id(10)}');
insert into profiles values ('${id(1)}','active',false),('${id(2)}','active',false),('${id(3)}','active',false),
 ('${id(4)}','active',false),('${id(5)}','active',false),('${id(6)}','active',false),('${id(7)}','active',false),('${id(8)}','active',false);
insert into school_members values ('${id(1)}','${id(10)}','teacher'),('${id(2)}','${id(10)}','teacher'),
 ('${id(3)}','${id(10)}','teacher'),('${id(4)}','${id(10)}','teacher'),
 ('${id(5)}','${id(11)}','teacher'),('${id(6)}','${id(10)}','parent'),('${id(7)}','${id(10)}','admin');
insert into teacher_classes values
 ('${id(1)}','${id(10)}','${id(20)}','${id(90)}',false),
 ('${id(2)}','${id(10)}','${id(20)}','${id(90)}',true),
 ('${id(3)}','${id(10)}','${id(20)}','${id(91)}',false),
 ('${id(4)}','${id(10)}','${id(21)}','${id(90)}',true),
 ('${id(5)}','${id(11)}','${id(22)}','${id(91)}',true);
insert into students (id,name) values ('${id(30)}','East 1'),('${id(31)}','East 2'),
 ('${id(32)}','West'),('${id(33)}','Other School');
update students set profile_id='${id(8)}' where id='${id(30)}';
insert into parent_student_links values ('${id(6)}','${id(30)}');
insert into student_classes values
 ('${id(10)}','${id(20)}','${id(30)}',true),
 ('${id(10)}','${id(20)}','${id(31)}',true),
 ('${id(10)}','${id(21)}','${id(32)}',true),
 ('${id(11)}','${id(22)}','${id(33)}',true);
insert into exams values ('${id(60)}','${id(10)}','Midterm',false,50),('${id(61)}','${id(11)}','Midterm',false,50);
insert into exam_subject_config values ('${id(60)}','${id(91)}',50,20);
insert into exam_results(id,exam_id,school_id,class_id,subject_id,student_id,teacher_id,marks)
 values ('${id(70)}','${id(60)}','${id(10)}','${id(20)}','${id(91)}','${id(30)}','${id(3)}',35),
 ('${id(71)}','${id(60)}','${id(10)}','${id(21)}','${id(90)}','${id(32)}','${id(4)}',55),
 ('${id(72)}','${id(61)}','${id(11)}','${id(22)}','${id(91)}','${id(33)}','${id(5)}',48),
 ('${id(73)}','${id(60)}','${id(10)}','${id(20)}','${id(90)}','${id(31)}','${id(2)}',60);
`);

await db.exec(readFileSync('supabase/migrations/20261011093500_class_exam_review_authority.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261011120000_class_exam_sheet_read_authority.sql','utf8'));
async function asUser(user,school=10) {
  await db.exec(`reset role; set request.jwt.claim.sub='${id(user)}';
    set request.active_school='${id(school)}'; set role authenticated;`);
}
async function readResults() { return db.query('select student_id,subject_id from public.exam_results order by student_id'); }
async function correction({user=2,school=10,cls=20,subject=91,student=30,exam=60,
  marks=40,state='entered',expected,reason='Corrected after checking original answer script'}={}) {
  await asUser(user,school);
  return db.query('select public.teacher_correct_class_exam_result($1,$2,$3,$4,$5,$6,$7,$8,$9) result',
    [id(exam),id(school),id(cls),id(subject),id(student),marks,state,expected,reason]);
}
await asUser(1);
assert.equal((await readResults()).rows.length,2,'subject teacher reviews all East subjects, no West');
let r=await db.query('select public.teacher_get_class_exam_sheet($1,$2,$3) sheet',[id(60),id(10),id(20)]);
assert.equal(r.rows[0].sheet.learners.length,2,'all currently enrolled students included');
assert.equal(r.rows[0].sheet.subjects.length,2,'entire class learning area roster projected');
assert.equal(r.rows[0].sheet.results.length,2,'results derive from canonical mark store');
assert.equal(r.rows[0].sheet.is_class_teacher,false);
assert.equal(r.rows[0].sheet.subjects.find(s=>s.id===id(90)).can_enter,true);
assert.equal(r.rows[0].sheet.subjects.find(s=>s.id===id(91)).can_enter,false);
await assert.rejects(()=>db.query('select public.teacher_get_class_exam_sheet($1,$2,$3)',[id(61),id(11),id(22)]),/active_school_changed|exam_class_not_authorized/);

assert.equal((await db.query('select public.teacher_is_current_class_teacher($1,$2) authorized',[id(10),id(20)])).rows[0].authorized,false);
await assert.rejects(()=>correction({user:1}),/class_teacher_not_authorized/);
await asUser(1);
const originalSubjectRecord=await db.query(
  'select updated_at from public.exam_results where id=$1',[id(73)]
);
const successorCorrection=await correction({
  user:1,subject:90,student:31,marks:61,
  expected:originalSubjectRecord.rows[0].updated_at,
  reason:'Teacher reassignment after checking original answer script',
});
assert.equal(Number(successorCorrection.rows[0].result.marks),61,
 'successor subject teacher may correct assigned subject only');
assert.equal(successorCorrection.rows[0].result.teacher_id,id(2),
 'original mark recorder remains unchanged after authorized handoff');

await asUser(3);
assert.equal((await readResults()).rows.length,2,'English teacher sees class wide');
let result=await db.query('update public.exam_results set marks=77 where id=$1 returning id',[id(71)]);
assert.equal(result.rows.length,0,'English teacher cannot edit West Mathematics');
result=await db.query('update public.exam_results set marks=77 where id=$1 returning id',[id(73)]);
assert.equal(result.rows.length,0,'English teacher cannot edit the current class Mathematics marks');
await asUser(2);
assert.equal((await readResults()).rows.length,2,'class teacher sees East');
r=await db.query('select public.teacher_get_class_exam_sheet($1,$2,$3) sheet',[id(60),id(10),id(20)]);
assert.equal(r.rows[0].sheet.is_class_teacher,true);
assert.equal(r.rows[0].sheet.subjects.every(s=>s.can_correct),true);

let before=await db.query('select updated_at from public.exam_results where id=$1',[id(70)]);
let expected=before.rows[0].updated_at;
const changed=await correction({expected});
assert.equal(Number(changed.rows[0].result.marks),40);
assert.equal(changed.rows[0].result.teacher_id,id(3),'original subject recorder preserved');
const fresh=changed.rows[0].result.updated_at;
await assert.rejects(()=>correction({expected,marks:42}),/result_changed_review_again/);
await assert.rejects(()=>correction({expected:fresh,marks:60}),/marks_outside_exam_maximum/);
await assert.rejects(()=>correction({expected:fresh,marks:0,state:'absent'}),/non_scored_result_cannot_have_marks/);
await assert.rejects(()=>correction({expected:fresh,reason:'short'}),/correction_reason_required/);
await assert.rejects(()=>correction({expected:fresh,student:31}),/result_not_entered_by_subject_teacher/);
await assert.rejects(()=>correction({expected:fresh,subject:92}),/class_subject_not_assigned/);
await assert.rejects(()=>correction({expected:fresh,cls:21,student:32}),/class_teacher_not_authorized/);
await assert.rejects(()=>correction({expected:fresh,school:11,cls:22,exam:61,student:33}),/class_teacher_not_authorized/);
await asUser(6);
assert.equal((await readResults()).rows.length,0,'parent role without appointment cannot read');
await assert.rejects(()=>db.query('select public.teacher_get_class_exam_sheet($1,$2,$3)',[id(60),id(10),id(20)]),/exam_class_not_authorized/);

await assert.rejects(()=>correction({user:6}),/class_teacher_not_authorized/);
await db.exec('reset role;set role anon');
await assert.rejects(
  ()=>db.query('select public.teacher_correct_class_exam_result($1,$2,$3,$4,$5,$6,$7,$8,$9)',
  [id(60),id(10),id(20),id(91),id(30),40,'entered',fresh,'Authorized only']),
  /permission denied/
);
await root(`update public.exams set is_locked=true where id='${id(60)}'`);
await assert.rejects(()=>correction({expected:fresh}),/exam_locked/);
await root(`update public.exams set is_locked=false where id='${id(60)}'`);
const absence=await correction({expected:fresh,marks:null,state:'absent'});
assert.equal(absence.rows[0].result.marks,null,'absence is not zero');
assert.equal(absence.rows[0].result.result_state,'absent');
await root(`update public.student_classes set is_current=false where student_id='${id(31)}'`);
await asUser(1);
assert.equal((await readResults()).rows.length,1,
  'former learner must disappear from teacher class-wide exam visibility');
await root(`update public.profiles set account_status='suspended' where id='${id(2)}'`);
await asUser(2);
assert.equal((await readResults()).rows.length,0,'inactive class teacher loses read');
await assert.rejects(()=>correction({expected:absence.rows[0].result.updated_at}),/class_teacher_not_authorized/);
await root(`update public.profiles set account_status='suspended' where id='${id(1)}'`);
await asUser(1);
assert.equal((await readResults()).rows.length,0,'suspended subject teacher cannot fall through old subject policy');
await root(`select 1`);
const audits=await db.query(`select actor_id,metadata from public.platform_events where event_type='authority.exam_result_class_correction' order by id`);
assert.equal(audits.rows.length,3,'each successful correction writes one reason-bearing audit');
assert.ok(audits.rows.some(r=>r.actor_id===id(2) && r.metadata.reason.includes('original answer script')));
assert.ok(audits.rows.some(r=>r.actor_id===id(1) && r.metadata.action==='corrected_by_subject_teacher'));
console.log('PASS isolated class exam authorization, state, audit and negative scenarios');

await root(`update public.profiles set account_status='active' where id in ('${id(1)}','${id(2)}')`);
await root(`update public.student_classes set is_current=true where student_id='${id(31)}'`);
await root(`update public.exam_results set result_state='entered',is_absent=false,marks=40
  where id='${id(70)}'`);
await root(`insert into public.exam_results(exam_id,school_id,class_id,subject_id,student_id,teacher_id,marks,max_marks)
 values ('${id(60)}','${id(10)}','${id(20)}','${id(90)}','${id(30)}','${id(1)}',78,100),
        ('${id(60)}','${id(10)}','${id(20)}','${id(91)}','${id(31)}','${id(3)}',42,50)`);
await db.exec(readFileSync('supabase/migrations/20261011122000_exam_submission_publication_authority.sql','utf8'));
await asUser(6);
assert.equal((await readResults()).rows.length,0,'unpublished marks hidden from linked parent');
await asUser(8);
assert.equal((await readResults()).rows.length,0,'unpublished marks hidden from learner');
await assert.rejects(
 ()=>db.query('select public.teacher_submit_class_exam_subject($1,$2,$3,$4)',[id(60),id(10),id(20),id(91)]),
 /subject_teacher_not_authorized/);
await asUser(3);
let sub=await db.query('select public.teacher_submit_class_exam_subject($1,$2,$3,$4) res',
  [id(60),id(10),id(20),id(91)]);
assert.equal(sub.rows[0].res.status,'submitted');
await assert.rejects(
  ()=>db.query('update public.exam_results set marks=40 where id=$1',[id(70)]),
  /subject_results_submitted_reopen_required/);
await asUser(1);
sub=await db.query('select public.teacher_submit_class_exam_subject($1,$2,$3,$4) res',
  [id(60),id(10),id(20),id(90)]);
assert.equal(sub.rows[0].res.status,'submitted');
await root(`select 1`);
await assert.rejects(
  ()=>db.query('update public.exam_subject_config set max_marks=100 where exam_id=$1 and subject_id=$2',
    [id(60),id(91)]),
  /subject_results_submitted_reopen_required/,
  'submitted scoring denominator may not be silently changed');
await asUser(6);
await assert.rejects(
  ()=>db.query('select public.school_review_class_exam_subject($1,$2,$3,$4,$5,$6)',
  [id(60),id(10),id(20),id(91),'verify',null]),
  /exam_review_admin_required/);
await asUser(7);
await assert.rejects(
  ()=>db.query('select public.school_set_class_exam_publication($1,$2,$3,$4,$5)',
  [id(60),id(10),id(20),true,null]),
  /exam_subjects_not_fully_verified/);
for(const subject of [90,91]){
  const review=await db.query('select public.school_review_class_exam_subject($1,$2,$3,$4,$5,$6) res',
    [id(60),id(10),id(20),id(subject),'verify',null]);
  assert.equal(review.rows[0].res.status,'verified');
}
const release=await db.query('select public.school_set_class_exam_publication($1,$2,$3,$4,$5) res',
  [id(60),id(10),id(20),true,null]);
assert.equal(release.rows[0].res.status,'published');
await asUser(6);
assert.equal((await readResults()).rows.length,2,'parent sees own published scores only');
await asUser(8);
assert.equal((await readResults()).rows.length,2,'learner sees own published scores only');
await asUser(3);
await assert.rejects(
 ()=>db.query('update public.exam_results set marks=41 where id=$1',[id(70)]),
 /exam_class_published_reopen_required/);
await asUser(7);
await assert.rejects(
 ()=>db.query('select public.school_set_class_exam_publication($1,$2,$3,$4,$5)',
  [id(60),id(10),id(20),false,'short']),
 /unpublish_reason_required/);
const revoke=await db.query('select public.school_set_class_exam_publication($1,$2,$3,$4,$5) res',
 [id(60),id(10),id(20),false,'Clerical review after transcription mistake']);
assert.equal(revoke.rows[0].res.status,'draft');
await asUser(6);
assert.equal((await readResults()).rows.length,0,'unpublishing revokes parent read');
await asUser(7);
const reopened=await db.query('select public.school_review_class_exam_subject($1,$2,$3,$4,$5,$6) res',
 [id(60),id(10),id(20),id(91),'reopen','English results need correction after review']);
assert.equal(reopened.rows[0].res.status,'reopened');
await asUser(3);
const edit=await db.query('update public.exam_results set marks=39 where id=$1 returning marks',[id(70)]);
assert.equal(Number(edit.rows[0].marks),39);
console.log('PASS exam subject submission, admin moderation, publication and privacy');
await db.close();
