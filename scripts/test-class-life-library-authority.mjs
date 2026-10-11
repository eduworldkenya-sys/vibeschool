/** Isolated PGlite tests for proposed school library and class leadership authority. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.WORKBOOK_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const [school,school2,cls,cls2,admin,teacher,subjectTeacher,outsider,learner,otherLearner,book,book2,grp,term]=Array.from({length:14},(_,i)=>id(i+1));
await db.exec(`
create role authenticated;create role anon;create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.schools(id uuid primary key);
create table public.profiles(id uuid primary key,full_name text,account_status text not null default 'active',is_anonymized boolean default false);
create table public.school_members(profile_id uuid,school_id uuid,role text,joined_at timestamptz default now());
create table public.staff(profile_id uuid,school_id uuid,status text,deleted_at timestamptz);
create table public.classes(id uuid primary key,school_id uuid references schools(id),name text);
create table public.students(id uuid primary key,name text,deleted_at timestamptz);
create table public.student_classes(student_id uuid,school_id uuid,class_id uuid,is_current boolean,joined_at timestamptz default now());
create table public.teacher_classes(teacher_id uuid,class_id uuid,school_id uuid,subject_id uuid,is_class_teacher boolean);
create table public.academic_terms(id uuid primary key,school_id uuid references schools(id),start_date date,end_date date);
create table public.class_groups(id uuid primary key,class_id uuid,school_id uuid,subject_id uuid,name text,archived_at timestamptz,expires_at timestamptz);
create table public.class_group_members(group_id uuid,student_id uuid);
create table public.library_books(id uuid primary key,school_id uuid,title text,total_copies int,available_copies int,deleted_at timestamptz);
create table public.library_borrowings(
id uuid primary key default gen_random_uuid(),school_id uuid,book_id uuid,borrower_type text,
student_id uuid,staff_id uuid,issued_by uuid,issued_at timestamptz default now(),
due_date date not null,returned_at timestamptz,condition_out text,condition_in text,
fine_amount numeric,fine_paid boolean,notes text,deleted_at timestamptz,issued_for_class_id uuid,issue_request_id uuid);
create unique index library_borrowings_issue_request_uidx on public.library_borrowings(issued_by,issue_request_id) where issue_request_id is not null;
create function public.is_school_admin(p_school uuid) returns boolean language sql stable security definer
set search_path=public,auth,pg_temp as $$select exists(select 1 from school_members where school_id=p_school and profile_id=auth.uid() and role='admin')$$;
create function public.is_operational_school_member(p_school uuid) returns boolean language sql stable security definer
set search_path=public,auth,pg_temp as $$select exists(select 1 from school_members where school_id=p_school and profile_id=auth.uid())$$;
create function public.teacher_can_access_class(p_class uuid,p_subject uuid,p_class_teacher boolean)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
select exists(select 1 from teacher_classes where class_id=p_class and teacher_id=auth.uid()
and (not p_class_teacher or is_class_teacher) and (p_subject is null or subject_id=p_subject))$$;
grant execute on function public.is_school_admin(uuid),public.is_operational_school_member(uuid),public.teacher_can_access_class(uuid,uuid,boolean) to authenticated;
grant select on public.profiles,public.schools,public.school_members,public.classes,public.students,public.student_classes,
public.teacher_classes,public.class_groups,public.class_group_members,public.academic_terms to authenticated;
grant select,insert,update,delete on public.library_books,public.library_borrowings to authenticated;
alter table public.library_books enable row level security;
alter table public.library_borrowings enable row level security;
create policy book_admin on public.library_books for all to authenticated using(is_school_admin(school_id)) with check(is_school_admin(school_id));
create policy loan_admin on public.library_borrowings for all to authenticated using(is_school_admin(school_id)) with check(is_school_admin(school_id));
`);
const insert=async(sql,...values)=>db.query(sql,values);
await insert('insert into schools values($1),($2)',school,school2);
await insert('insert into profiles(id,full_name) values($1,$2),($3,$4),($5,$6),($7,$8),($9,$10)',admin,'Admin',teacher,'Class Teacher',subjectTeacher,'Subject Teacher',outsider,'Outsider',id(15),'Librarian');
await insert("insert into staff(profile_id,school_id,status) values($1,$2,'active')",id(15),school);
await insert("insert into profiles(id,full_name,account_status) values($1,'Disabled Staff','suspended')",id(16));
await insert("insert into profiles(id,full_name,account_status,is_anonymized) values($1,'Anonymized Staff','active',true)",id(17));
await insert("insert into staff(profile_id,school_id,status) values($1,$3,'active'),($2,$3,'active')",id(16),id(17),school);
await insert("insert into school_members(profile_id,school_id,role) values($1,$2,'admin'),($3,$2,'teacher'),($4,$2,'teacher'),($5,$6,'admin')",admin,school,teacher,subjectTeacher,outsider,school2);
await insert("insert into classes values($1,$2,'Grade 8 East'),($3,$4,'Grade 8 West')",cls,school,cls2,school2);
await insert('insert into students values($1,$2,null),($3,$4,null)',learner,'Learner One',otherLearner,'Learner Two');
await insert('insert into student_classes(student_id,school_id,class_id,is_current) values($1,$2,$3,true),($4,$5,$6,true)',learner,school,cls,otherLearner,school2,cls2);
await insert('insert into teacher_classes values($1,$2,$3,null,true),($4,$2,$3,$5,false)',teacher,cls,school,subjectTeacher,id(99));
await insert('insert into class_groups(id,class_id,school_id,subject_id,name) values($1,$2,$3,$4,$5)',grp,cls,school,id(99),'Team A');
await insert('insert into class_group_members values($1,$2)',grp,learner);
await insert('insert into academic_terms values($1,$2,current_date-30,current_date+30)',term,school);
await insert("insert into library_books values($1,$2,'Book One',2,2,null),($3,$4,'Outside Book',2,2,null)",book,school,book2,school2);
// Verify the exact canonical SQL that is committed for Supabase deployment,
// not only draft copies under docs/.
for(const migration of [
  'supabase/migrations/20261011082922_class_life_library_borrower_authority.sql',
  'supabase/migrations/20261011082925_class_life_leadership_authority.sql',
  'supabase/migrations/20261011082928_class_life_physical_library_copies.sql'
]) {try{await db.exec(fs.readFileSync(migration,'utf8'))}catch(error){console.error('Canonical migration failed:',migration,error.message);throw error}}
async function as(user){await db.exec("reset role;set request.jwt.claim.sub='"+user+"';set role authenticated;")}
async function scalar(sql,values=[]){return (await db.query(sql,values)).rows[0]?.value}
async function stock(){return (await db.query('select available_copies from library_books where id=$1',[book])).rows[0].available_copies}
async function copies(){return (await db.query('select state,count(*)::int n from library_book_copies where book_id=$1 group by state',[book])).rows.reduce((a,r)=>({...a,[r.state]:r.n}),{})}
async function copyId(loan){return (await db.query('select copy_id from library_borrowings where id=$1',[loan])).rows[0].copy_id}
const issue="select public.school_issue_library_book($1,$2,null,current_date+7,'good',$3) value";
await as(admin);
const options=await scalar('select public.school_library_borrower_options($1) value',[school]);
assert.equal(options.students.length,1);
assert.equal(options.staff.length,4,'only active, non-anonymized school staff appear as borrowers');
assert.deepEqual(await copies(),{available:2},'backfilled catalogue has individual available copies');
const staffLoan=await scalar("select public.school_issue_library_book($1,null,$2,current_date+7,'good',$3) value",[book,id(15),id(60)]);
assert.ok(staffLoan,'registered non-teaching staff can borrow');
await assert.rejects(()=>scalar("select public.school_issue_library_book($1,null,$2,current_date+7,'good',$3) value",[book,id(16),id(81)]),/staff_profile_not_active/);
await assert.rejects(()=>scalar("select public.school_issue_library_book($1,null,$2,current_date+7,'good',$3) value",[book,id(17),id(82)]),/staff_profile_not_active/);
await scalar("select public.school_return_library_book($1,'good',0,false) value",[staffLoan]);
const loan=await scalar(issue,[book,learner,id(30)]);
assert.equal(loan,await scalar(issue,[book,learner,id(30)]),'retries must be idempotent');
assert.equal(await stock(),1);
assert.deepEqual(await copies(),{available:1,on_loan:1},'issue marks one physical copy on loan');
assert.ok(await copyId(loan),'borrowing records canonical physical copy');
await assert.rejects(()=>scalar(issue,[book,otherLearner,id(31)]),/borrower_not_currently_enrolled/);
await assert.rejects(()=>scalar(issue,[book2,learner,id(32)]),/school_admin_required/);
await assert.rejects(()=>db.query("insert into library_borrowings(school_id,book_id,borrower_type,student_id,due_date) values($1,$2,'student',$3,current_date+7)",[school,book,learner]),/permission denied/);
await scalar("select public.school_return_library_book($1,'good',0,false) value",[loan]);
assert.equal(await stock(),2);
assert.deepEqual(await copies(),{available:2},'return restores physical copy');
await assert.rejects(()=>scalar("select public.school_return_library_book($1,'good',0,false) value",[loan]),/borrowing_already_returned/);
const lost=await scalar(issue,[book,learner,id(33)]);
await scalar("select public.school_return_library_book($1,'lost',0,false) value",[lost]);
assert.equal(await stock(),1,'lost books do not re-enter circulation');
assert.deepEqual(await copies(),{available:1,lost:1},'lost physical copy stays marked lost');
const newBook=id(77);
await insert("insert into library_books values($1,$2,'New School Book',3,3,null)",newBook,school);
assert.equal((await db.query('select count(*)::int n from library_book_copies where book_id=$1',[newBook])).rows[0].n,3,'new catalogue insert seeds unique physical copies');
const newCopyList=await scalar('select public.school_list_library_copies($1) value',[newBook]);
assert.equal(newCopyList.length,3,'admin can inspect registered physical copies');
const restocked=await scalar('select public.school_restock_library_book($1,2,$2) value',[newBook,id(61)]);
assert.equal(restocked,newBook);
assert.equal(restocked,await scalar('select public.school_restock_library_book($1,2,$2) value',[newBook,id(61)]),'duplicate restock must be idempotent');
assert.equal((await db.query('select total_copies,available_copies from library_books where id=$1',[newBook])).rows[0].total_copies,5);
assert.equal((await db.query('select public.school_list_library_copies($1) value',[newBook])).rows[0].value.length,5);
await assert.rejects(()=>scalar('select public.school_restock_library_book($1,3,$2) value',[newBook,id(61)]),/inventory_request_payload_conflict/);
const damagedLoan=await scalar(issue,[newBook,learner,id(63)]);
await scalar("select public.school_return_library_book($1,'damaged',0,false) value",[damagedLoan]);
const damagedCopy=await copyId(damagedLoan);
assert.equal((await db.query('select state from library_book_copies where id=$1',[damagedCopy])).rows[0].state,'repair');
assert.equal((await db.query('select available_copies from library_books where id=$1',[newBook])).rows[0].available_copies,4);
await scalar('select public.school_repair_library_copy($1,$2) value',[damagedCopy,id(62)]);
assert.equal((await db.query('select available_copies from library_books where id=$1',[newBook])).rows[0].available_copies,5,'repair restores available inventory once');
await scalar('select public.school_repair_library_copy($1,$2) value',[damagedCopy,id(62)]);
assert.equal((await db.query('select available_copies from library_books where id=$1',[newBook])).rows[0].available_copies,5,'repair retry cannot duplicate stock');
await assert.rejects(()=>scalar('select public.school_repair_library_copy($1,$2) value',[damagedCopy,id(64)]),/copy_not_awaiting_repair/);
const lostCopy=(await db.query("select id from library_book_copies where book_id=$1 and state='lost'",[book])).rows[0].id;
await assert.rejects(()=>scalar('select public.school_repair_library_copy($1,$2) value',[lostCopy,id(65)]),/copy_not_awaiting_repair/);
const activeBeforeArchive=await scalar(issue,[newBook,learner,id(70)]);
await assert.rejects(()=>scalar('select public.school_archive_library_book($1) value',[newBook]),/book_has_active_borrowings/);
assert.equal((await db.query('select deleted_at from library_books where id=$1',[newBook])).rows[0].deleted_at,null);
await scalar("select public.school_return_library_book($1,'good',0,false) value",[activeBeforeArchive]);
await scalar('select public.school_archive_library_book($1) value',[newBook]);
await scalar('select public.school_archive_library_book($1) value',[newBook]);
assert.equal((await db.query("select count(*)::int n from library_book_copies where book_id=$1 and state='retired'",[newBook])).rows[0].n,5,'retired catalogue retains individual accessions');
assert.equal((await db.query('select available_copies from library_books where id=$1',[newBook])).rows[0].available_copies,0);
await assert.rejects(()=>scalar(issue,[newBook,learner,id(71)]),/school_book_not_found/);
await assert.rejects(()=>db.query("update library_books set deleted_at=now() where id=$1",[book]),/permission denied/);
await as(outsider);
await assert.rejects(()=>scalar('select public.school_archive_library_book($1) value',[book]),/school_admin_required/);
await assert.rejects(()=>scalar('select public.school_list_library_copies($1) value',[book]),/school_admin_required/);
await assert.rejects(()=>scalar('select public.school_restock_library_book($1,1,$2) value',[book,id(67)]),/school_admin_required/);
await assert.rejects(()=>scalar('select public.school_repair_library_copy($1,$2) value',[lostCopy,id(68)]),/school_admin_required/);
await assert.rejects(()=>db.query("update library_book_copies set state='available' where id=$1",[damagedCopy]),/permission denied/);
await assert.rejects(()=>db.query("insert into library_inventory_events(school_id,book_id,actor_id,request_id,action,quantity) values($1,$2,$3,$4,'restock',1)",[school,book,outsider,id(69)]),/permission denied/);
await assert.rejects(()=>scalar('select public.school_library_borrower_options($1) value',[school]),/school_admin_required/);
await assert.rejects(()=>scalar(issue,[book,learner,id(34)]),/school_admin_required/);
await as(admin);
await scalar('select public.school_archive_library_book($1) value',[book]);
assert.equal((await db.query('select state from library_book_copies where id=$1',[lostCopy])).rows[0].state,'lost','archive preserves lost-copy physical evidence');
await as(teacher);
const appoint="select public.school_appoint_class_learner($1,$2,$3,current_date,current_date+7,$4,$5) value";
const rep=await scalar(appoint,[cls,learner,'representative',null,id(40)]);
assert.equal(rep,await scalar(appoint,[cls,learner,'representative',null,id(40)]));
await assert.rejects(()=>scalar(appoint,[cls2,learner,'representative',null,id(41)]),/leadership_authorization_required/);
await assert.rejects(()=>scalar(appoint,[cls,otherLearner,'deputy',null,id(42)]),/learner_not_currently_enrolled/);
const future=await scalar("select public.school_appoint_class_learner($1,$2,'representative',current_date+5,current_date+10,null,$3) value",[cls,learner,id(46)]);
assert.ok(future,'future scheduled leadership appointments supported');
const previousAppointment=await db.query('select ends_on::text as ends_on,handover_request_id,handover_scheduled_by from class_learner_appointments where id=$1',[rep]);
assert.equal(previousAppointment.rows[0].handover_request_id,id(46),'future handover preserves attributable request');
assert.equal(previousAppointment.rows[0].handover_scheduled_by,teacher,'future handover records appointing teacher');
const leadership=await scalar('select public.school_get_class_leadership($1) value',[cls]);
assert.equal(leadership.current.some(a=>a.id===rep),true,'incumbent remains until handover');
assert.equal(leadership.upcoming.some(a=>a.id===future),true,'future appointments separated');
const learnerHistory=await scalar('select public.school_get_learner_leadership($1,$2) value',[cls,learner]);
assert.equal(learnerHistory.length,2,'same class authority projects learner leadership history');
await as(subjectTeacher);
const readLeadership=await scalar('select public.school_get_class_leadership($1) value',[cls]);
assert.equal(readLeadership.current.some(a=>a.role==='representative'),true,'assigned subject teacher may read class leadership');
const groupLeader=await scalar(appoint,[cls,learner,'group_leader',grp,id(43)]);
assert.ok(groupLeader);
await assert.rejects(()=>scalar(appoint,[cls,learner,'prefect',null,id(44)]),/leadership_authorization_required/);
await as(outsider);
await assert.rejects(()=>scalar('select public.school_get_class_leadership($1) value',[cls]),/leadership_authorization_required/);
await assert.rejects(()=>scalar('select public.school_get_learner_leadership($1,$2) value',[cls,learner]),/leadership_authorization_required/);
await as(teacher);
await scalar("select public.school_end_class_learner_appointment($1,'completed') value",[rep]);
assert.equal((await db.query('select ended_reason from class_learner_appointments where id=$1',[rep])).rows[0].ended_reason,'completed');
const secondRep=await scalar("select public.school_appoint_class_learner($1,$2,'representative',current_date,current_date+2,null,$3) value",[cls,learner,id(50)]);
await db.exec('reset role');
await db.query('delete from public.class_group_members where group_id=$1 and student_id=$2',[grp,learner]);
assert.equal((await db.query('select ended_reason from class_learner_appointments where id=$1',[groupLeader])).rows[0].ended_reason,'completed','group membership removal ends group leader appointment');
await db.query('update public.student_classes set is_current=false where student_id=$1 and class_id=$2',[learner,cls]);
assert.equal((await db.query('select ended_reason from class_learner_appointments where id=$1',[secondRep])).rows[0].ended_reason,'completed','leaving class closes formal office');
await db.close();
console.log('Isolated library circulation and class leadership authorization checks PASS');
