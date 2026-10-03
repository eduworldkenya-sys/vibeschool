import fs from 'node:fs'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
const sql=p=>fs.readFileSync(p,'utf8')
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const [teacher,other,school,otherSchool,klass,subject,learner,exam]=[1,2,10,11,20,30,40,50].map(uuid)

// Minimal domain fixture; the candidate SQL, canonical Twin tables, subject
// authorization helper and consequential result RLS below are real migrations.
await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth; create schema extensions;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table profiles(id uuid primary key,account_status text default 'active',is_anonymized boolean default false);
 create table schools(id uuid primary key);
 create table classes(id uuid primary key,school_id uuid);
 create table subjects(id uuid primary key,school_id uuid);
 create table students(id uuid primary key,profile_id uuid,deleted_at timestamptz);
 create table school_members(profile_id uuid,school_id uuid,role text);
 create table teacher_classes(teacher_id uuid,school_id uuid,class_id uuid,subject_id uuid);
 create table student_classes(student_id uuid,school_id uuid,class_id uuid,is_current boolean);
 create table parent_student_links(parent_id uuid,student_id uuid,access_level text);
 create table exams(id uuid primary key,school_id uuid,is_locked boolean,created_by uuid);
 alter table exams enable row level security;
 create policy exams_member_read on exams for select to authenticated using(exists(select 1 from school_members where profile_id=auth.uid() and school_id=exams.school_id));
 create policy exams_teacher on exams for all to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
 create function public.is_school_admin(p_school_id uuid) returns boolean language sql stable as $$ select exists(select 1 from school_members where profile_id=auth.uid() and school_id=p_school_id and role='admin') $$;
 create function public.current_student_id() returns uuid language sql stable as $$ select id from students where profile_id=auth.uid() and deleted_at is null limit 1 $$;
 create function public.is_platform_owner() returns boolean language sql stable as $$ select auth.uid()='${uuid(999)}'::uuid $$;
 create function public.is_teacher_of_student(p_student_id uuid) returns boolean language sql stable as $$ select exists(select 1 from teacher_classes tc join school_members sm on sm.profile_id=tc.teacher_id and sm.school_id=tc.school_id and sm.role='teacher' join student_classes sc on sc.class_id=tc.class_id and sc.school_id=tc.school_id and sc.is_current where tc.teacher_id=auth.uid() and sc.student_id=p_student_id) $$;
 create function public.teacher_get_operating_context(p_requested_school_id uuid default null) returns jsonb language plpgsql stable as $$ begin p_requested_school_id:=coalesce(p_requested_school_id,(select school_id from school_members where profile_id=auth.uid() and role='teacher' limit 1));if not exists(select 1 from school_members where profile_id=auth.uid() and school_id=p_requested_school_id and role='teacher') then raise exception 'teacher_scope_not_authorized';end if;return jsonb_build_object('school_id',p_requested_school_id);end $$;
 grant usage on schema public,auth to authenticated,anon;
 grant select on profiles,schools,classes,subjects,students,school_members,teacher_classes,student_classes,parent_student_links to authenticated;
 grant select,update on exams to authenticated;
`)
await db.exec(sql('supabase/migrations/20260531120000_twin_schema.sql'))
const examMigration=sql('supabase/migrations/20260817145640_pilot_exam_result_authority_scope.sql')
await db.exec(examMigration.slice(examMigration.indexOf('create table'),examMigration.indexOf('-- Reconstruct pre-existing')))
const canonical=sql('supabase/migrations/20260819011000_task3_student_teacher_boundary_semantic_closure.sql')
await db.exec(canonical.slice(canonical.indexOf('create or replace function public.is_live_teacher_class'),canonical.indexOf('-- Canonical roster boundary.')))
await db.exec(canonical.slice(canonical.indexOf('drop policy if exists "Teachers view exam results'),canonical.indexOf('-- Assessment attempts.')))
await db.exec('grant select,insert,update,delete on twin_memory,twin_profile to authenticated;')
await db.exec(sql('supabase/migrations/20261003160927_canonical_personal_twin.sql'))
await db.exec(`insert into profiles(id) values('${teacher}'),('${other}');insert into schools values('${school}'),('${otherSchool}');insert into classes values('${klass}','${school}');insert into subjects values('${subject}','${school}');insert into students values('${learner}',null,null);insert into school_members values('${teacher}','${school}','teacher');insert into teacher_classes values('${teacher}','${school}','${klass}','${subject}');insert into student_classes values('${learner}','${school}','${klass}',true);insert into exams values('${exam}','${school}',false,'${other}');`)
const asUser=async user=>db.exec(`reset role;set request.jwt.claim.sub='${user}';set role authenticated;`)
const query=async(text,params=[])=> (await db.query(text,params)).rows
async function deny(text,params=[],pattern){await assert.rejects(()=>query(text,params),pattern)}
const save=`select teacher_save_exam_result($1,$2,$3,$4,$5,$6,false,$7) as result`
const args=[exam,school,klass,subject,learner,40,null]
await asUser(teacher)
const first=(await query(save,args))[0].result
assert.equal(Number(first.marks),40)
const retried=(await query(save,args))[0].result
assert.equal(retried.id,first.id)
await deny(save,[...args.slice(0,5),44,null],/result_changed_review_again/)
const updated=(await query(save,[...args.slice(0,5),44,first.updated_at]))[0].result
assert.equal(Number(updated.marks),44)
await deny(save,[...args.slice(0,5),45,first.updated_at],/result_changed_review_again/)
for(const score of [-1,101,'NaN'])await deny(save,[...args.slice(0,5),score,updated.updated_at],/marks_must_be_0_to_100/)
await deny(save,[exam,otherSchool,klass,subject,learner,40,null],/active_school_changed/)
await deny(save,[exam,school,klass,uuid(31),learner,40,null],/teacher_subject_not_authorized/)
await deny(save,[exam,school,klass,subject,uuid(41),40,null],/student_not_in_current_class/)
await db.exec(`reset role;update exams set is_locked=true where id='${exam}';`)
await asUser(teacher);await deny(save,args,/exam_locked/)
await db.exec(`reset role;update exams set is_locked=false where id='${exam}';`)
await asUser(other);await deny(save,args,/teacher_scope_not_authorized/)
await asUser(teacher)
// A failed batch rolls back every earlier row and every memory trigger.
const batchRow={exam_id:exam,school_id:school,class_id:klass,subject_id:subject,student_id:learner,marks:50,is_absent:false,expected_updated_at:updated.updated_at}
await deny('select teacher_save_exam_results($1::jsonb)',[JSON.stringify([batchRow,{...batchRow,student_id:uuid(41)}])],/student_not_in_current_class/)
assert.equal(Number((await query('select marks from exam_results where student_id=$1',[learner]))[0].marks),44)
await deny('select teacher_save_exam_results($1::jsonb)',[JSON.stringify([batchRow,batchRow])],/duplicate_mark_target/)
const batch=(await query('select teacher_save_exam_results($1::jsonb) as rows',[JSON.stringify([batchRow])]))[0].rows
assert.equal(Number(batch[0].marks),50)
// Another authorized teacher must never take over the existing result.
await db.exec(`reset role;insert into school_members values('${other}','${school}','teacher');insert into teacher_classes values('${other}','${school}','${klass}','${subject}');`)
await asUser(other);await assert.rejects(()=>query(save,args));
await db.exec(`reset role;delete from school_members where profile_id='${other}';delete from teacher_classes where teacher_id='${other}';`)
await asUser(teacher)
await db.exec(`reset role;update profiles set account_status='suspended' where id='${teacher}';`)
await asUser(teacher);await deny(save,args,/teacher_account_not_active/)
await db.exec(`reset role;update profiles set account_status='active' where id='${teacher}';update students set deleted_at=now() where id='${learner}';`)
await asUser(teacher);await deny(save,args,/student_not_in_current_class/)
await db.exec(`reset role;update students set deleted_at=null where id='${learner}';`)
await asUser(teacher)
const baselineActivity=(await query(`select count(*)::int as n from twin_memory where type='activity_v1'`))[0].n
assert.ok(baselineActivity>=2,'successful exam mutations must feed personal memory while drawer is closed')
const observe='select twin_observe_activity($1,$2,$3,$4,$5) as ok'
const observed=['teacher',school,'/teacher/results','results',uuid(200)]
assert.equal((await query(observe,observed))[0].ok,true)
await query(observe,observed)
assert.equal((await query(`select count(*)::int as n from twin_memory where type='activity_v1'`))[0].n,baselineActivity+1)
await deny(observe,['teacher',otherSchool,'/teacher/results','results',uuid(201)],/teacher_scope_not_authorized/)
await deny(observe,['teacher',school,'/hq/users','results',uuid(202)],/invalid_twin_observation/)
await deny(observe,['teacher',school,'/teacher/results?student=secret','results',uuid(203)],/invalid_twin_observation/)
await query(`select twin_set_personal_settings(false,false)`)
assert.equal((await query(observe,['teacher',school,'/teacher/results','results',uuid(204)]))[0].ok,false)
await query(`select twin_set_personal_settings(true,false)`)
await asUser(other)
assert.equal((await query('select count(*)::int as n from twin_memory'))[0].n,0)
await deny(`select twin_get_personal_memory('teacher',$1)`,[school],/teacher_scope_not_authorized/)
await asUser(teacher)
const memory=(await query(`select twin_get_personal_memory('teacher',$1) as memory`,[school]))[0].memory
assert.equal(memory.observations.length,baselineActivity+1)
assert.equal(memory.settings.collective,false)
assert.deepEqual((await query(`select twin_collective_hints('teacher',$1,'results') as hints`,[school]))[0].hints,[])
assert.equal(Number((await query('select twin_forget_activity() as n'))[0].n),baselineActivity+1)
assert.equal((await query('select count(*)::int as n from twin_memory'))[0].n,0)
await db.exec(`reset role;delete from school_members where profile_id='${teacher}';`)
await asUser(teacher);await deny(save,args,/teacher_scope_not_authorized/);await deny(observe,observed,/teacher_scope_not_authorized/)
await db.exec(`reset role;set role anon;`)
await deny('select twin_forget_activity()',[],/permission denied/)
await deny(save,args,/permission denied/)
await db.close()
console.log('Personal Twin PostgreSQL: canonical result RLS, range limits, retries, stale saves, locked exams, enrollment, cross-school/subject, membership revocation, scoped memory, pause/forget, cohort suppression and anonymous denials passed.')
