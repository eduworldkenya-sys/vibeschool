/** Real PostgreSQL function/trigger tests in an isolated fixture, not connected-project certification. */
import fs from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.WORKBOOK_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite(),
  uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const teacher = uuid(1),
  other = uuid(2),
  school = uuid(3),
  cls = uuid(4),
  subject = uuid(5),
  student = uuid(6),
  outcome = uuid(7),
  support = uuid(8),
  extension = uuid(9),
  assignment = uuid(10),
  attempt = uuid(11);
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
create table school_members(profile_id uuid,school_id uuid,status text);
create table teacher_classes(teacher_id uuid,school_id uuid,class_id uuid,subject_id uuid);
create function is_active_school_member(uuid) returns boolean language sql stable security definer as $$select exists(select 1 from school_members where profile_id=auth.uid() and school_id=$1 and status='active')$$;
create function teacher_get_operating_context() returns jsonb language sql stable security definer as $$select jsonb_build_object('school_id',nullif(current_setting('test.school',true),''))$$;
create table curriculum_learning_outcomes(id uuid primary key,outcome_code text,outcome_text text);
create table assessment_interventions(id uuid primary key,teacher_id uuid,school_id uuid,class_id uuid,subject_id uuid,student_id uuid,outcome_id uuid,status text,completion_note text,due_at timestamptz,completed_at timestamptz,updated_at timestamptz,priority text,recommendation text,recommendation_type text,mastery_score numeric,evidence_snapshot jsonb default '{}',remedial_assessment_id uuid,remedial_assignment_id uuid,baseline_mastery_score numeric,followup_mastery_score numeric,mastery_change numeric,evaluated_at timestamptz);
create table assessment_definitions(id uuid primary key default gen_random_uuid(),school_id uuid,teacher_id uuid,class_id uuid,subject_id uuid,assessment_type text,title text,description text,instructions text,status text,generation_source text,generation_status text,generation_metadata jsonb,intervention_id uuid,created_at timestamptz default now());
create table assessment_attempts(id uuid primary key,assignment_id uuid,student_id uuid,status text,result_status text,teacher_reviewed_at timestamptz,updated_at timestamptz,submitted_at timestamptz,created_at timestamptz);
create table students(id uuid primary key,name text);
create table student_classes(student_id uuid,class_id uuid,school_id uuid,is_current boolean);
create table competency_evidence_ledger(student_id uuid,outcome_id uuid,subject_id uuid,evidence_source text,score numeric,max_score numeric,observed_at timestamptz,created_at timestamptz default now());
alter table assessment_interventions alter column id set default gen_random_uuid(),add column evidence_count integer default 0,add column confidence_score numeric default 0,add column repeated_weakness_count integer default 0;
create unique index assessment_interventions_open_uidx on assessment_interventions(teacher_id,class_id,student_id,outcome_id) where status in ('open','in_progress','escalated');
create table assessment_assignments(id uuid primary key,school_id uuid,class_id uuid,teacher_id uuid,assessment_id uuid);
alter table assessment_attempts add column score numeric,add column max_score numeric,add column percentage numeric,add column feedback text,add column reviewed_by uuid,add column released_at timestamptz,add column active_client_id uuid,add column client_lease_expires_at timestamptz,add column client_lease_updated_at timestamptz,add column locked_at timestamptz,add column lock_reason text;
create table assessment_responses(id uuid primary key,attempt_id uuid,status text,auto_score numeric,teacher_score numeric,final_score numeric,max_score numeric,teacher_feedback text,teacher_override_reason text,marked_by uuid,marked_at timestamptz,updated_at timestamptz);
create table assessment_moderation_requests(id uuid primary key default gen_random_uuid(),attempt_id uuid,response_id uuid,status text);
create table student_outcome_mastery(student_id uuid,outcome_id uuid,mastery_score numeric,mastery_level text default 'developing',evidence_count integer default 4,last_evidence_at timestamptz default now());
create function exq_sync_attempt_outcome_evidence(uuid) returns void language sql as $$select$$;
-- Boundary fixture: source RLS remains owner SELECT only, no direct update grant/policy.
alter table assessment_interventions enable row level security;
create policy owner_read on assessment_interventions for select to authenticated using(teacher_id=auth.uid());
grant select on assessment_interventions to authenticated;
insert into school_members values('${teacher}','${school}','active');
insert into teacher_classes values('${teacher}','${school}','${cls}','${subject}');
insert into students values('${student}','Learner'),('${uuid(16)}','Extension learner');
insert into student_classes values('${student}','${cls}','${school}',true),('${uuid(16)}','${cls}','${school}',true);
insert into curriculum_learning_outcomes values('${outcome}','M1','Apply fractions');
insert into assessment_interventions(id,teacher_id,school_id,class_id,subject_id,student_id,outcome_id,status,priority,recommendation,recommendation_type,mastery_score,evidence_snapshot) values
('${support}','${teacher}','${school}','${cls}','${subject}','${student}','${outcome}','open','high','Use worked examples','guided_practice',30,'{"evidence_sources":["assessment"]}'),
('${extension}','${teacher}','${school}','${cls}','${subject}','${uuid(16)}','${outcome}','open','extension','Apply in a new context','extension_challenge',85,'{}');
`);
  const sql = fs.readFileSync(
    "supabase/migrations/20261009160000_assessment_support_audit_repair.sql",
    "utf8",
  );
  await db.exec(sql);
  async function login(user = teacher, activeSchool = school) {
    await db.exec(
      `reset role;set request.jwt.claim.sub='${user}';set test.school='${activeSchool}';set role authenticated`,
    );
  }
  async function scalar(query, args = []) {
    return (await db.query(query, args)).rows[0]?.value;
  }
  const update = (id, status, note = null, due = null) =>
    scalar("select exq_update_intervention($1,$2,$3,$4) value", [
      id,
      status,
      note,
      due,
    ]);
  await login(other);
  await assert.rejects(() => update(support, "in_progress"), /not_owned/);
  assert.equal(
    await scalar("select count(*)::int value from assessment_interventions"),
    0,
    "RLS hides another teacher’s record",
  );
  await login(teacher, uuid(99));
  await assert.rejects(
    () => update(support, "in_progress"),
    /context_not_authorized/,
  );
  await login();
  await assert.rejects(
    () => update(support, null),
    /invalid_intervention_status/,
  );
  await assert.rejects(
    () => update(support, "completed", "Finished manually"),
    /requires_evidence/,
  );
  await assert.rejects(
    () => update(support, "dismissed", ""),
    /reason_required/,
  );
  assert.equal(
    await scalar(
      "select status value from assessment_interventions where id=$1",
      [support],
    ),
    "open",
    "rejected transitions leave the record unchanged",
  );
  await update(
    support,
    "in_progress",
    "Worked examples in a small group",
    "2026-10-20T06:00:00Z",
  );
  let row = (
    await db.query("select * from assessment_interventions where id=$1", [
      support,
    ])
  ).rows[0];
  assert.equal(row.completion_note, "Worked examples in a small group");
  assert.equal(row.evidence_snapshot.lifecycle_history.length, 1);
  assert.equal(row.evidence_snapshot.lifecycle_history[0].actor_id, teacher);
  await update(
    support,
    "dismissed",
    "Duplicate support plan, evidence retained",
  );
  await assert.rejects(() => update(support, "open"), /reason_required/);
  await update(support, "open", "New evidence warrants another review");
  await assert.rejects(
    () =>
      db.query(
        "update assessment_interventions set status='completed' where id=$1",
        [support],
      ),
    /permission denied/,
    "frontend cannot bypass the guarded RPC",
  );
  // Refresh replacement cannot erase audit history or create a fake action.
  await db.exec("reset role");
  await db.query(
    "update assessment_interventions set evidence_snapshot='{" +
      '"evidence_sources":["released_assessment"],"lifecycle_history":[]}' +
      "'::jsonb where id=$1",
    [support],
  );
  row = (
    await db.query("select * from assessment_interventions where id=$1", [
      support,
    ])
  ).rows[0];
  assert.equal(row.evidence_snapshot.lifecycle_history.length, 3);
  await login();
  const created = await scalar(
    "select exq_create_intervention_assessment($1,null) value",
    [extension],
  );
  const repeat = await scalar(
    "select exq_create_intervention_assessment($1,null) value",
    [extension],
  );
  assert.equal(created.assessment_id, repeat.assessment_id);
  assert.equal(repeat.created, false);
  await db.exec("reset role");
  row = (
    await db.query("select * from assessment_definitions where id=$1", [
      created.assessment_id,
    ])
  ).rows[0];
  assert.match(row.title, /Extension Practice/);
  assert.equal(row.assessment_type, "practice");
  assert.deepEqual(
    row.generation_metadata.required_design.difficulty_progression,
    ["independent", "application", "challenge"],
  );
  await db.query(
    "update assessment_interventions set remedial_assignment_id=$1 where id=$2",
    [assignment, support],
  );
  await db.query(
    "insert into assessment_attempts(id,assignment_id,student_id,status,result_status) values($1,$2,$3,'marked','marked')",
    [attempt, assignment, student],
  );
  await db.query("insert into student_outcome_mastery(student_id,outcome_id,mastery_score) values($1,$2,75)", [
    student,
    outcome,
  ]);
  await login();
  await assert.rejects(
    () => scalar("select exq_evaluate_intervention($1) value", [support]),
    /not_released/,
  );
  await db.exec("reset role");
  await db.query(
    "update assessment_attempts set status='released',result_status='released' where id=$1",
    [attempt],
  );
  await login();
  const result = await scalar("select exq_evaluate_intervention($1) value", [
    support,
  ]);
  assert.equal(result.status, "completed");
  assert.equal(result.mastery_change, 45);
  await assert.rejects(
    () => scalar("select exq_evaluate_intervention($1) value", [support]),
    /closed/,
    "closed plan cannot be reevaluated without a deliberate reopen",
  );
  row = (
    await db.query("select * from assessment_interventions where id=$1", [
      support,
    ])
  ).rows[0];
  assert.equal(
    row.evidence_snapshot.lifecycle_history.at(-1).to_status,
    "completed",
  );
  await db.exec("reset role;set request.jwt.claim.sub='';set role anon");
  await assert.rejects(
    () =>
      scalar("select exq_update_intervention($1,$2,null,null) value", [
        support,
        "open",
      ]),
    /permission denied/,
  );
  // Exercise actual marking/finalization guards and raw score denominators.
  await db.exec('reset role');
  await db.query("insert into assessment_definitions(id,school_id,teacher_id,class_id,subject_id,status) values($1,$2,$3,$4,$5,'open')",[uuid(12),school,teacher,cls,subject]);
  await db.query('insert into assessment_assignments values($1,$2,$3,$4,$5)',[assignment,school,cls,teacher,uuid(12)]);
  await db.query("insert into assessment_attempts(id,assignment_id,student_id,status,result_status) values($1,$2,$3,'teacher_review','partially_marked')",[uuid(20),assignment,student]);
  await db.query("insert into assessment_responses(id,attempt_id,status,auto_score,final_score,max_score) values($1,$2,'teacher_review',null,null,5),($3,$2,'marked',5,5,5),($4,$2,'void',null,100,100)",[uuid(21),uuid(20),uuid(22),uuid(23)]);
  const mark=(score,reason=null,response=uuid(21))=>scalar('select exq_mark_response($1,$2,null,$3) value',[response,score,reason]);
  const finish=(release=false)=>scalar('select exq_finalize_attempt($1,$2,$3) value',[uuid(20),'Explain the reasoning',release]);
  await login(other);await assert.rejects(()=>mark(2),/not_owned/);
  await login(teacher,uuid(99));await assert.rejects(()=>mark(2),/context_not_authorized/);
  await login();await assert.rejects(()=>mark(null),/invalid_score/);await assert.rejects(()=>mark(-1),/invalid_score/);await assert.rejects(()=>mark(6),/invalid_score/);await assert.rejects(()=>finish(),/unmarked/);await assert.rejects(()=>mark(1,null,uuid(23)),/void_response/);
  await mark(2.5);await assert.rejects(()=>mark(0,null,uuid(22)),/override_reason/);await mark(0,'The answer is incorrect',uuid(22));
  await db.exec('reset role');await db.query("insert into assessment_moderation_requests(attempt_id,response_id,status) values($1,$2,'pending')",[uuid(20),uuid(21)]);
  await login();await assert.rejects(()=>mark(3),/review_pending/);const privateResult=await finish();assert.equal(privateResult.status,'marked');assert.equal(privateResult.score,2.5);assert.equal(privateResult.max_score,10);assert.equal(privateResult.percentage,25);await assert.rejects(()=>finish(true),/review_pending_release_blocked/);
  await db.exec("reset role;update assessment_moderation_requests set status='approved'");await login();const released=await finish(true);assert.equal(released.status,'released');assert.equal(released.result_status,'released');await assert.rejects(()=>mark(3),/locked/);await assert.rejects(()=>finish(),/locked/);
  // Explicit refresh respects current school, closed history and teacher review dates.
  await db.exec('reset role');await db.query("insert into competency_evidence_ledger(student_id,outcome_id,subject_id,evidence_source,score,max_score,observed_at) values($1,$2,$3,'assessment_response',5,10,now())",[student,outcome,subject]);
  await login();await assert.rejects(()=>scalar('select exq_refresh_intervention_queue(null) value'),/class_context/);await assert.rejects(()=>scalar('select exq_refresh_intervention_queue($1) value',[uuid(99)]),/class_context/);
  assert.equal((await scalar('select exq_refresh_intervention_queue($1) value',[cls])).rows_refreshed,0,'unchanged evidence cannot recreate a completed plan');
  await db.exec('reset role');await db.query("update student_outcome_mastery set mastery_score=50,last_evidence_at=now()+interval '1 second' where student_id=$1",[student]);await login();assert.equal((await scalar('select exq_refresh_intervention_queue($1) value',[cls])).rows_refreshed,1);
  const refreshed=(await db.query("select * from assessment_interventions where student_id=$1 and status='open'",[student])).rows[0];await update(refreshed.id,'in_progress','Review the new evidence','2030-01-01T06:00:00Z');
  const historyCount=(await db.query('select evidence_snapshot from assessment_interventions where id=$1',[refreshed.id])).rows[0].evidence_snapshot.lifecycle_history.length;
  await scalar('select exq_refresh_intervention_queue($1) value',[cls]);const preserved=(await db.query('select * from assessment_interventions where id=$1',[refreshed.id])).rows[0];assert.equal(new Date(preserved.due_at).toISOString(),'2030-01-01T06:00:00.000Z');assert.equal(preserved.evidence_snapshot.lifecycle_history.length,historyCount,'unchanged refresh does not invent lifecycle events');
  await db.exec('reset role');await db.query('update student_outcome_mastery set mastery_score=76 where student_id=$1',[student]);await login();await scalar('select exq_refresh_intervention_queue($1) value',[cls]);const revision=(await db.query('select priority,recommendation_type from assessment_interventions where id=$1',[refreshed.id])).rows[0];assert.equal(revision.priority,'medium');assert.equal(revision.recommendation_type,'targeted_revision','proficient revision is not mislabeled extension');
  // Repeat installation preserves existing history and data (no destructive schema operations).
  await db.exec("reset role");
  await db.exec(sql);
  assert.equal(
    await scalar("select count(*)::int value from assessment_interventions"),
    3,
  );
  console.log(
    "Assessment support DB: PASS — actual SQL, ownership/current-school guards, RLS boundary, blank reason rejection, audited plan/reopen/dismiss, refresh history preservation, extension idempotency, released-evidence completion and replay. Isolated fixture only.",
  );
} finally {
  await db.close();
}
