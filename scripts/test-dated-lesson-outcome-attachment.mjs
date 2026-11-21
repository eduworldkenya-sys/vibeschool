import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'

const engine = process.env.PILOT_PGLITE_MODULE
if (!engine) throw new Error('PILOT_PGLITE_MODULE is required')
const {PGlite} = await import(pathToFileURL(engine).href)
const db=new PGlite()
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const [teacher, outsider, school, classroom, subject, slot, firstScheme, otherScheme, outcome, otherOutcome, strand, firstPlan, secondPlan, occurrence, term]=Array.from({length:15},(_,n)=>id(n+1))
try{
 await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  grant usage on schema auth to authenticated;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
  create table public.scheme_of_work(id uuid primary key,teacher_id uuid,school_id uuid,class_id uuid,subject_id uuid,curriculum_outcome_id uuid,sub_strand_id uuid,academic_term_id uuid,week integer);
  create table public.scheme_lesson_outcomes(scheme_lesson_id uuid,curriculum_outcome_id uuid);
  create table public.curriculum_learning_outcomes(id uuid primary key,sub_strand_id uuid,status text);
  create table public.lesson_plans(id uuid primary key,teacher_id uuid,school_id uuid,class_id uuid,subject_id uuid,scheme_id uuid,curriculum_outcome_id uuid,timetable_slot_id uuid,taught_date date);
  create table public.timetable_slots(id uuid primary key,school_id uuid,teacher_id uuid,class_id uuid,subject_id uuid,day_of_week integer,effective_from date,effective_until date);
  create table public.teacher_classes(teacher_id uuid,school_id uuid,class_id uuid,subject_id uuid);
  create table public.teaching_occurrences(id uuid primary key,timetable_slot_id uuid,occurrence_date date,lifecycle text);
  create table public.teaching_occurrence_outcomes(teaching_occurrence_id uuid,curriculum_outcome_id uuid);
  create function public.resolve_instructional_week_for_date(uuid,date) returns table(term_id uuid,week_number integer) language sql as $$ select '${term}'::uuid,11 $$;
  create function public.teacher_os_bind_outcome_lineage() returns trigger language plpgsql as $$ begin return new; end $$;
  create trigger lesson_plan_bind_outcome_lineage before insert or update of scheme_id,curriculum_outcome_id on public.lesson_plans
    for each row execute function public.teacher_os_bind_outcome_lineage();
  insert into public.scheme_of_work values
    ('${firstScheme}','${teacher}','${school}','${classroom}','${subject}',null,'${strand}','${term}',11),
    ('${otherScheme}','${teacher}','${school}','${classroom}','${subject}','${otherOutcome}','${strand}','${term}',11);
  insert into public.scheme_lesson_outcomes values ('${firstScheme}','${outcome}');
  insert into public.curriculum_learning_outcomes values ('${outcome}','${strand}','verified'),('${otherOutcome}','${strand}','active');
  insert into public.timetable_slots values ('${slot}','${school}','${teacher}','${classroom}','${subject}',4,'2026-11-01',null);
  insert into public.teacher_classes values ('${teacher}','${school}','${classroom}','${subject}');
  insert into public.teaching_occurrences values ('${occurrence}','${slot}','2026-11-12','planned');
 `)
 const sql=readFileSync('supabase/migrations/20261121180000_restore_dated_lesson_outcome_attachment.sql','utf8')
 await db.exec(sql)
 await db.exec(sql)
 const grants=(await db.query(`select has_function_privilege('anon','public.attach_scheme_to_dated_lesson(uuid,uuid,uuid)','EXECUTE') as anon, has_function_privilege('authenticated','public.attach_scheme_to_dated_lesson(uuid,uuid,uuid)','EXECUTE') as authenticated`)).rows[0]
 assert.deepEqual(grants,{anon:false,authenticated:true})
 const plans=`insert into public.lesson_plans values
   ('${firstPlan}','${teacher}','${school}','${classroom}','${subject}','${firstScheme}',null,'${slot}','2026-11-12'),
   ('${secondPlan}','${teacher}','${school}','${classroom}','${subject}',null,null,'${slot}','2026-11-12')`
 await db.exec(plans)
 assert.equal((await db.query('select curriculum_outcome_id from public.lesson_plans where id=$1',[firstPlan])).rows[0].curriculum_outcome_id,outcome)
 async function attach(who,scheme,target){
   await db.query("select set_config('test.user_id',$1,false)",[who])
   await db.exec('set role authenticated')
   try{return (await db.query('select * from public.attach_scheme_to_dated_lesson($1,$2,$3)',[secondPlan,scheme,target])).rows[0]}
   finally{await db.exec('reset role')}
 }
 await assert.rejects(attach(outsider,firstScheme,outcome),/lesson_plan_not_owned/)
 await db.query('update public.scheme_of_work set week=10 where id=$1',[firstScheme])
 await assert.rejects(attach(teacher,firstScheme,outcome),/scheme_occurrence_week_mismatch/)
 await db.query('update public.scheme_of_work set week=11 where id=$1',[firstScheme])
 await assert.rejects(attach(teacher,firstScheme,otherOutcome),/scheme_outcome_mismatch/)
 assert.equal((await attach(teacher,firstScheme,outcome)).curriculum_outcome_id,outcome)
 await db.exec("update public.teaching_occurrences set lifecycle='completed'")
 await assert.rejects(attach(teacher,otherScheme,otherOutcome),/occurrence_outcome_immutable/)
 assert.equal((await attach(teacher,firstScheme,outcome)).scheme_id,firstScheme)
 console.log('Dated attachment SQL passed on PostgreSQL fixture: replay, UUID fallback, instructional week, owned plan, verified outcome and completed lesson immutability.')
}finally{await db.close()}
