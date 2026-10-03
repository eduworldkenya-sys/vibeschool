/** Focused PostgreSQL tests execute the actual migrations; full reconstruction runs in CI. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.WORKBOOK_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
create table profiles(id uuid primary key,role text,account_status text,is_anonymized boolean);
create table schools(id uuid primary key);create table subjects(id uuid primary key,name text);
create table classes(id uuid primary key,school_id uuid references schools(id));
create table school_members(profile_id uuid,school_id uuid,role text);
create table teacher_classes(teacher_id uuid,school_id uuid,class_id uuid,subject_id uuid,is_class_teacher boolean);
create table students(id uuid primary key default gen_random_uuid(),name text,admission_number text,gender text,date_of_birth date,class_id uuid,created_by uuid,deleted_at timestamptz);
create table student_classes(id uuid primary key default gen_random_uuid(),student_id uuid,school_id uuid,class_id uuid,is_current boolean,left_at timestamptz,joined_at timestamptz default clock_timestamp(),unique(student_id,class_id),check((is_current and left_at is null) or(not is_current and left_at>joined_at)));
create unique index one_current_student on student_classes(student_id) where is_current;
create table student_claim_codes(student_id uuid,code text,claimed boolean,role text);
create table student_provisioning_receipts(actor_id uuid,operation text,payload_hash text,student_id uuid,primary key(actor_id,operation,payload_hash));
create table teaching_occurrences(id uuid primary key);
create table class_groups(id uuid primary key default gen_random_uuid(),class_id uuid,name text,color text,created_at timestamptz default now());
create table class_group_members(id uuid primary key default gen_random_uuid(),group_id uuid references class_groups(id),student_id uuid references students(id),unique(group_id,student_id));
create table assessment_interventions(id uuid,class_id uuid,school_id uuid,teacher_id uuid,subject_id uuid,created_at timestamptz);
create table attendance(id uuid default gen_random_uuid(),student_id uuid,class_id uuid,school_id uuid,status text,timetable_slot_id uuid);
create table homework(id uuid primary key,class_id uuid,school_id uuid,teacher_id uuid,subject text,due_date date,target_group_id uuid);
create table homework_submissions(id uuid default gen_random_uuid(),homework_id uuid,student_id uuid,status text);
create table assessment_gradebook_entries(student_id uuid,class_id uuid,school_id uuid,teacher_id uuid,subject_id uuid,assessment_id uuid,percentage numeric,released_at timestamptz);
grant select,insert,update,delete on profiles,schools,subjects,classes,school_members,teacher_classes,students,student_classes,class_groups,class_group_members,attendance,homework,homework_submissions,assessment_gradebook_entries to authenticated;
alter table class_groups enable row level security;alter table class_group_members enable row level security;
insert into profiles values('${id(1)}','teacher','active',false),('${id(2)}','teacher','active',false),('${id(3)}','teacher','active',false);
insert into schools values('${id(10)}'),('${id(11)}');insert into subjects values('${id(90)}','English');
insert into classes values('${id(20)}','${id(10)}'),('${id(21)}','${id(11)}'),('${id(22)}','${id(10)}');
insert into school_members values('${id(1)}','${id(10)}','teacher'),('${id(2)}','${id(11)}','teacher'),('${id(3)}','${id(10)}','teacher');
insert into teacher_classes values('${id(1)}','${id(10)}','${id(20)}','${id(90)}',true),('${id(1)}','${id(10)}','${id(22)}','${id(90)}',true),('${id(2)}','${id(11)}','${id(21)}','${id(90)}',true),('${id(3)}','${id(10)}','${id(20)}','${id(90)}',false);
insert into students(id,name,admission_number,class_id) values('${id(30)}','Charles','1024','${id(20)}'),('${id(31)}','Mary','1025','${id(20)}'),('${id(32)}','Other school',null,'${id(21)}');
insert into student_classes(student_id,school_id,class_id,is_current) values('${id(30)}','${id(10)}','${id(20)}',true),('${id(31)}','${id(10)}','${id(20)}',true),('${id(32)}','${id(11)}','${id(21)}',true);`);
for(const file of ['20261002103000_class_operating_system_foundation.sql','20261003112738_canonical_class_workbook.sql','20261003113554_class_workspace_lifecycle_and_scope.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
async function user(n){await db.exec(`reset role;set request.jwt.claim.sub='${id(n)}';set role authenticated;`);}
async function action(request=50,ids=[30,31],note='Practise fractions',subject=null){return db.query('select teacher_record_class_action($1,$2,$3,$4,$5,$6,$7) n',[id(20),subject===null?null:id(subject),ids.map(id),'observation',note,null,id(request)]);}
await user(1);let r=await action();assert.equal(r.rows[0].n,2);await action();r=await db.query('select * from teacher_learner_events');assert.equal(r.rows.length,2,'retry is exactly once');
await assert.rejects(()=>action(50,[30,31],'Changed note'),/request_conflict/);
await assert.rejects(()=>action(51,[30,32]),/learner_not_in_class/);r=await db.query('select * from teacher_learner_events');assert.equal(r.rows.length,2,'partial group action must roll back');
await user(2);await assert.rejects(()=>action(52),/not_authorized/);r=await db.query('select * from teacher_learner_events');assert.equal(r.rows.length,0,'private teacher notes remain private');
await user(3);await assert.rejects(()=>action(53),/not_authorized/);await action(54,[30],'Subject participation',90);
r=await db.query('select teacher_create_workbook_group($1,$2,$3,$4,$5) id',[id(10),id(20),'Reading',[id(30)],id(60)]);assert.equal(r.rows[0].id,id(60));r=await db.query('select subject_id from class_groups where id=$1',[id(60)]);assert.equal(r.rows[0].subject_id,id(90),'subject teacher group keeps subject authority');
await user(1);
async function manage(action,payload,request=70,student=30){return db.query('select teacher_manage_class_learner($1,$2,$3,$4::jsonb,$5)',[id(20),id(student),action,JSON.stringify(payload),id(request)]);}
const original={name:'Charles',admission_number:'1024',gender:null,date_of_birth:null};
await assert.rejects(()=>manage('edit',{...original,name:'Changed',expected:{...original,name:'stale'}}),/learner_edit_conflict/);
await assert.rejects(()=>manage('edit',{...original,admission_number:'1025',expected:original}),/admission_identifier_conflict/);
await manage('edit',{...original,name:'Charles Mwangi',expected:original},71);await manage('edit',{...original,name:'Charles Mwangi',expected:original},71);
r=await db.query('select name from students where id=$1',[id(30)]);assert.equal(r.rows[0].name,'Charles Mwangi');
await assert.rejects(()=>manage('move',{target_class_id:id(21)},72),/not_authorized/);
await manage('move',{target_class_id:id(22)},73);r=await db.query('select class_id from student_classes where student_id=$1 and is_current',[id(30)]);assert.equal(r.rows[0].class_id,id(22));await assert.rejects(()=>manage('restore',{},74),/learner_restore_conflict/);
await manage('leave',{},75,31);r=await db.query('select * from teacher_get_departed_class_learners($1)',[id(20)]);assert.equal(r.rows[0].id,id(31));await manage('restore',{},76,31);r=await db.query('select * from student_classes where student_id=$1 and is_current',[id(31)]);assert.equal(r.rows[0].class_id,id(20));
// Real smart rule must use latest released evidence rather than an older failure.
await db.exec(`reset role;insert into assessment_gradebook_entries values('${id(31)}','${id(20)}','${id(10)}','${id(1)}','${id(90)}','${id(80)}',30,'2026-10-01'),('${id(31)}','${id(20)}','${id(10)}','${id(1)}','${id(90)}','${id(81)}',70,'2026-10-02'),('${id(31)}','${id(20)}','${id(10)}','${id(1)}','${id(90)}','${id(82)}',5,null);`);await user(1);
await db.query("insert into class_groups(id,class_id,name,color,type,mode,rules) values($1,$2,'Support','#244c37','support','smart',$3::jsonb)",[id(85),id(20),JSON.stringify({rule:'assessment_below',threshold:50})]);r=await db.query('select * from teacher_resolve_class_group_members($1)',[id(85)]);assert.equal(r.rows.length,0,'improved learner must not be selected by older failure');
// Scoreboards must start and reset atomically, with retry and cohort authority.
for(const n of [86,87])await db.query("insert into class_groups(id,class_id,name,color,type,mode) values($1,$2,$3,'#244c37','game','static')",[id(n),id(20),'Team '+n]);
let game=await db.query('select teacher_start_class_game($1,$2,$3,$4,$5) id',[id(20),null,'Revision',[id(86),id(87)],id(88)]);assert.equal(game.rows[0].id,id(88));await db.query('select teacher_start_class_game($1,$2,$3,$4,$5)',[id(20),null,'Revision',[id(86),id(87)],id(88)]);r=await db.query('select * from classroom_game_teams where game_id=$1',[id(88)]);assert.equal(r.rows.length,2);
await assert.rejects(()=>db.query('select teacher_start_class_game($1,$2,$3,$4,$5)',[id(20),null,'Bad',[id(86),id(60)],id(89)]),/scope_mismatch/);r=await db.query('select * from classroom_games where id=$1',[id(89)]);assert.equal(r.rows.length,0,'failed scoreboard must leave no orphan');
await db.query('select teacher_adjust_game_score($1,$2)',[r.rows[0]?.id??(await db.query('select id from classroom_game_teams where game_id=$1',[id(88)])).rows[0].id,5]);r=await db.query('select teacher_reset_class_game($1) n',[id(88)]);assert.equal(r.rows[0].n,2);r=await db.query('select score from classroom_game_teams where game_id=$1',[id(88)]);assert(r.rows.every(t=>t.score===0));
// Retry-safe roster creation rejects changed input, absence of admission remains optional.
r=await db.query('select teacher_add_student_v2($1,$2,$3,$4,$5) id',['Amina',null,id(20),id(10),id(95)]);const added=r.rows[0].id;r=await db.query('select teacher_add_student_v2($1,$2,$3,$4,$5) id',['Amina',null,id(20),id(10),id(95)]);assert.equal(r.rows[0].id,added);await assert.rejects(()=>db.query('select teacher_add_student_v2($1,$2,$3,$4,$5)',['Different',null,id(20),id(10),id(95)]),/roster_request_conflict/);
await db.exec(`reset role;update profiles set account_status='suspended' where id='${id(1)}'`);await user(1);await assert.rejects(()=>action(99),/not_authorized/);await assert.rejects(()=>manage('leave',{},100,31),/class_teacher_required/);
await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select teacher_get_departed_class_learners($1)',[id(20)]),/permission denied/);
await db.close();console.log('Classroom database: actual migrations, atomic actions, retries, tenant/subject isolation, lifecycle history, stale edits, latest-score smart lists and inactive-account denial passed.');
