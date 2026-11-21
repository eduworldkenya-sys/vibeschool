import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
const { PGlite } = await import(pathToFileURL(process.env.LIVE_TEST_ENGINE || '/tmp/live-test/node_modules/@electric-sql/pglite/dist/index.js').href)

// Disposable synthetic identities; no production environment or credentials.
export async function createLiveFixture(){
const db=new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create schema realtime;
create table realtime.messages(topic text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb);
alter table realtime.messages enable row level security;
grant usage on schema realtime to anon,authenticated;
grant select on realtime.messages to anon,authenticated;
create function realtime.topic() returns text language sql stable as $topic$ select nullif(current_setting('realtime.topic',true),'') $topic$;
create function realtime.send(jsonb,text,text,boolean) returns void language plpgsql security definer as $sender$ begin insert into realtime.messages(topic,payload) values($3,$1); end $sender$;
grant execute on function realtime.topic() to anon,authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
create table profiles(id uuid primary key,account_status text,role text default 'student',is_anonymized boolean default false);
create table classes(id uuid primary key,school_id uuid,name text);
create table students(id uuid primary key,profile_id uuid,deleted_at timestamptz,name text);
create table student_classes(student_id uuid,class_id uuid,school_id uuid,is_current boolean);
create table teacher_classes(teacher_id uuid,class_id uuid,school_id uuid);
create table school_members(school_id uuid,profile_id uuid,role text);
create table independent_learner_identities(user_id uuid,account_state text,learner_email_verified_at timestamptz,grade_label text);
create table parent_student_links(parent_id uuid,student_id uuid);
create table vibetutor_tutors(profile_id uuid,status text,display_name text);
create table vibetutor_student_invitations(id uuid,tutor_id uuid,student_id uuid,status text);
create table vibetutor_private_groups(id uuid primary key,tutor_id uuid,title text);
create table vibetutor_private_group_members(group_id uuid,invitation_id uuid);
create function public.teacher_can_access_class(uuid,uuid,boolean) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.teacher_classes where class_id=$1 and teacher_id=auth.uid()) $$;
create function public.teacher_get_operating_context(uuid) returns jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('school_id',school_id) from public.teacher_classes where teacher_id=auth.uid() limit 1 $$;
`)
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const parent=id(6), solo=id(7), cpa=id(8), teacher=id(1), a=id(2), b=id(3), outsider=id(4), otherTeacher=id(5), cls=id(10), otherCls=id(11), school=id(20), otherSchool=id(21)
await db.exec(`
insert into profiles(id,account_status) values ${[teacher,a,b,outsider,otherTeacher,parent,solo,cpa].map(x=>`('${x}','active')`).join(',')};
insert into classes values ('${cls}','${school}','Grade 4'),('${otherCls}','${otherSchool}','Grade 5');
update profiles set role='teacher' where id in ('${teacher}','${otherTeacher}');
update profiles set role='parent' where id='${parent}';
insert into school_members values ('${school}','${teacher}','teacher'),('${otherSchool}','${otherTeacher}','teacher');
insert into teacher_classes values ('${teacher}','${cls}','${school}'),('${otherTeacher}','${otherCls}','${otherSchool}');
insert into students values ('${id(30)}','${a}',null,'Learner A'),('${id(31)}','${b}',null,'Learner B'),('${id(32)}','${outsider}',null,'Outsider'),('${id(33)}','${solo}',null,'Homeschool learner'),('${id(34)}','${cpa}',null,'Muted learner');
insert into independent_learner_identities values ('${solo}','restricted',now(),'Grade 4'),('${cpa}','restricted',now(),'Professional Studies');
insert into parent_student_links values ('${parent}','${id(33)}');
insert into vibetutor_tutors values ('${teacher}','published','Verified tutor'),('${otherTeacher}','paused','Other tutor');
insert into vibetutor_student_invitations values ('${id(40)}','${teacher}','${id(30)}','accepted'),('${id(41)}','${teacher}','${id(33)}','accepted'),('${id(42)}','${teacher}','${id(31)}','pending_guardian'),('${id(43)}','${teacher}','${id(34)}','accepted');
insert into vibetutor_private_groups values ('${id(50)}','${teacher}','Math group'),('${id(51)}','${otherTeacher}','Private group');
insert into vibetutor_private_group_members values ('${id(50)}','${id(40)}'),('${id(50)}','${id(41)}');
insert into student_classes values ('${id(30)}','${cls}','${school}',true),('${id(31)}','${cls}','${school}',true),('${id(32)}','${otherCls}','${otherSchool}',true);
`)
await db.exec(readFileSync(new URL('../supabase/migrations/20261118075221_live_classroom_pilot.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261120104500_live_lesson_history_candidate.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261120104501_live_learner_tools_candidate.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261120104502_live_teacher_workspace.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261121084500_live_past_classes.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261121102000_live_private_conversations.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261121121000_live_private_realtime_invalidation.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261121141000_live_moderated_chat_waiting_typing.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261121150000_live_quiz_teacher_responses.sql',import.meta.url),'utf8'))
await db.exec(readFileSync(new URL('../supabase/migrations/20261121153000_live_presenter_scroll_follow.sql',import.meta.url),'utf8'))
async function rpc(who,action,room=null,version=null,payload={},classId=cls,role='authenticated') {
 await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${who||''}',false)`)
 try {return (await db.query('select public.vibe_live_command($1,$2,$3,$4,$5::jsonb) as out',[action,classId,room,version,JSON.stringify(payload)])).rows[0].out}
 finally {await db.exec('reset role')}
}

return {db,rpc,id,parent,solo,cpa,teacher,a,b,outsider,otherTeacher,cls,otherCls,school,otherSchool}
}
