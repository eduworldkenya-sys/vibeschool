import fs from "node:fs";
import assert from "node:assert/strict";

const modulePath = process.env.SCHOOL_LIFE_PGLITE_MODULE;
if (!modulePath) throw new Error("SCHOOL_LIFE_PGLITE_MODULE is required");
const { PGlite } = await import(modulePath);
const db = new PGlite();
const ids = {
  schoolA: "10000000-0000-4000-8000-000000000001",
  schoolB: "10000000-0000-4000-8000-000000000002",
  classA: "20000000-0000-4000-8000-000000000001",
  classB: "20000000-0000-4000-8000-000000000002",
  teacherA: "30000000-0000-4000-8000-000000000001",
  teacherB: "30000000-0000-4000-8000-000000000002",
  subjectOnly: "30000000-0000-4000-8000-000000000003",
  admin: "30000000-0000-4000-8000-000000000004",
  learnerA: "40000000-0000-4000-8000-000000000001",
  learnerB: "40000000-0000-4000-8000-000000000002",
  request: "50000000-0000-4000-8000-000000000001",
  request2: "50000000-0000-4000-8000-000000000002",
};
const q = async sql => (await db.query(sql)).rows;
const scalar = async sql => (await q(sql))[0]?.value;
const as = async uid => { await q(`select set_config('test.jwt.sub','${uid}',false)`); };
await db.exec(`
create role authenticated;
create role anon;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.jwt.sub',true),'')::uuid;
$$;
create table public.profiles(id uuid primary key);
create table public.schools(id uuid primary key);
create table public.classes(id uuid primary key,school_id uuid not null references public.schools(id));
create table public.students(id uuid primary key,name text not null,deleted_at timestamptz);
create table public.student_classes(student_id uuid,class_id uuid,school_id uuid,is_current boolean);
create table public.teacher_classes(teacher_id uuid,class_id uuid,is_class_teacher boolean);
create table public.school_admins(profile_id uuid,school_id uuid);
create function public.teacher_can_access_class(p_class uuid,p_subject uuid default null,p_class_teacher boolean default false)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
  select exists (select 1 from public.teacher_classes t where t.class_id=p_class
    and t.teacher_id=auth.uid() and (not p_class_teacher or t.is_class_teacher));
$$;
create function public.is_school_admin(p_school uuid)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
  select exists(select 1 from public.school_admins a where a.school_id=p_school and a.profile_id=auth.uid());
$$;
`);
for (const id of [ids.teacherA,ids.teacherB,ids.subjectOnly,ids.admin]) await q(`insert into public.profiles values('${id}')`);
for (const id of [ids.schoolA,ids.schoolB]) await q(`insert into public.schools values('${id}')`);
for (const [c,s] of [[ids.classA,ids.schoolA],[ids.classB,ids.schoolB]]) await q(`insert into public.classes values('${c}','${s}')`);
for (const [s,name] of [[ids.learnerA,'Football learner'],[ids.learnerB,'Other school learner']]) await q(`insert into public.students(id,name) values('${s}','${name}')`);
for (const [s,c,sc] of [[ids.learnerA,ids.classA,ids.schoolA],[ids.learnerB,ids.classB,ids.schoolB]])
  await q(`insert into public.student_classes values('${s}','${c}','${sc}',true)`);
await q(`insert into public.teacher_classes values('${ids.teacherA}','${ids.classA}',true),('${ids.teacherB}','${ids.classB}',true),('${ids.subjectOnly}','${ids.classA}',false)`);
await q(`insert into public.school_admins values('${ids.admin}','${ids.schoolA}')`);
await db.exec(fs.readFileSync("supabase/migrations/20261011110000_canonical_learner_school_life.sql","utf8"));

await as(ids.teacherA);
await q("set role authenticated");
const id = await scalar(`select public.teacher_save_school_life_activity('${ids.classA}',null,'Football','sport',null,'class') value`);
assert.ok(id, "Teacher can create class sports activity");
const snap = await scalar(`select public.teacher_school_life_snapshot('${ids.classA}') value`);
assert.equal(snap.activities[0].title,"Football");
assert.equal(snap.students.length,1);
assert.equal(snap.memberships.length,0);
await assert.rejects(() => q("select * from public.school_life_participations"), /permission denied/i, "Direct browser table reads blocked");
const add=`select public.teacher_set_school_life_members('${id}',array['${ids.learnerA}']::uuid[],'save','member','Captain',null,'${ids.request}') value`;
assert.equal(await scalar(add),1);
assert.equal(await scalar(add),1,"Identical network retry is idempotent");
const withMember = await scalar(`select public.teacher_school_life_snapshot('${ids.classA}') value`);
assert.equal(withMember.memberships.length,1);
assert.equal(withMember.memberships[0].position,"Captain");
await assert.rejects(
  () => scalar(`select public.teacher_set_school_life_members('${id}',array['${ids.learnerB}']::uuid[],'save','member',null,null,'${ids.request2}') value`),
  /scope_invalid/i,"School A teacher cannot change School B learners");
await assert.rejects(
  () => scalar(`select public.teacher_set_school_life_members('${id}',array['${ids.learnerA}']::uuid[],'end','member',null,null,'${ids.request}') value`),
  /request_id_payload_conflict/i,"Request key cannot be replayed with different payload");
await q("reset role");
await as(ids.subjectOnly);
await q("set role authenticated");
await assert.rejects(
  () => scalar(`select public.teacher_school_life_snapshot('${ids.classA}') value`),
  /class_teacher_scope_required/i,"Subject-only teacher cannot read entire class");
await q("reset role");
await as(ids.teacherA);
await q("set role authenticated");
assert.equal(await scalar(`select public.teacher_set_school_life_members('${id}',array['${ids.learnerA}']::uuid[],'end','member',null,null,'${ids.request2}') value`),1);
const ending = await scalar(`select public.teacher_school_life_snapshot('${ids.classA}') value`);
assert.equal(ending.memberships.length,0);
await q("reset role");
const hist=await scalar(`select count(*)::int value from public.school_life_participation_history where action in ('joined','ended')`);
assert.equal(hist,2,"Previous membership kept in immutable event history");
await as(ids.admin);
await q("set role authenticated");
const schoolId = await scalar(`select public.teacher_save_school_life_activity('${ids.classA}',null,'School Athletics','sport',null,'school') value`);
assert.ok(schoolId,"School admin can create school-wide activity");
await q("reset role");
await as(ids.teacherA);
await q("set role authenticated");
await assert.rejects(() => scalar(`select public.teacher_save_school_life_activity('${ids.classA}',null,'School Drama','arts',null,'school') value`),
  /school_scope_requires_admin/i,"Class teachers cannot create school-wide records");
console.log("PASS: isolated SQL DDL; class teacher writes; bulk retry; cross-school/subject denial; immutable history; school-admin scope");
await db.close();
