/** Run with WORKBOOK_PGLITE_MODULE pointing to an installed @electric-sql/pglite module. */
import fs from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.WORKBOOK_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
await db.exec(`create role authenticated;create role anon;create role service_role;
create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
create table profiles(id uuid primary key,role text,account_status text,is_anonymized boolean);
create table schools(id uuid primary key);
create table classes(id uuid primary key,school_id uuid references schools(id));
create table school_members(profile_id uuid,school_id uuid,role text);
create table teacher_classes(teacher_id uuid,school_id uuid,class_id uuid,subject_id uuid);
create table students(id uuid primary key,deleted_at timestamptz);
create table student_classes(student_id uuid,school_id uuid,class_id uuid,is_current boolean);
create table class_groups(id uuid primary key default gen_random_uuid(),class_id uuid references classes(id),name text,color text,type text);
create table class_group_members(id uuid primary key default gen_random_uuid(),group_id uuid references class_groups(id),student_id uuid references students(id),unique(group_id,student_id));
grant select on profiles,schools,classes,school_members,teacher_classes,students,student_classes to authenticated;
insert into profiles values('${id(1)}','teacher','active',false),('${id(2)}','teacher','active',false),('${id(3)}','parent','active',false);
insert into schools values('${id(10)}'),('${id(11)}');insert into classes values('${id(20)}','${id(10)}'),('${id(21)}','${id(11)}');
insert into school_members values('${id(1)}','${id(10)}','teacher'),('${id(2)}','${id(11)}','teacher');
insert into teacher_classes values('${id(1)}','${id(10)}','${id(20)}','${id(90)}'),('${id(2)}','${id(11)}','${id(21)}','${id(90)}');
insert into students values('${id(30)}',null),('${id(31)}',null);insert into student_classes values('${id(30)}','${id(10)}','${id(20)}',true),('${id(31)}','${id(11)}','${id(21)}',true);`);
// Exercise the actual existing canonical group policies, not permissive substitutes.
await db.exec(
  fs.readFileSync(
    "supabase/migrations/20260818002145_pilot_class_group_teacher_authority_closure.sql",
    "utf8",
  ),
);
await db.exec(
  fs.readFileSync(
    "supabase/migrations/20261003112738_canonical_class_workbook.sql",
    "utf8",
  ),
);
const doc = {
  version: 1,
  sheets: [
    {
      id: "custom",
      title: "Reading",
      kind: "custom",
      columns: [
        { id: "note", label: "Note", type: "text" },
        { id: "score", label: "Score", type: "number" },
      ],
    },
  ],
  cells: { custom: { [id(30)]: { note: "Ready", score: 0 } } },
  views: [],
};
async function user(n) {
  await db.exec(
    `reset role;set request.jwt.claim.sub='${id(n)}';set role authenticated;`,
  );
}
async function save(rev, document = doc, school = 10, cls = 20) {
  return db.query(
    "select public.teacher_save_class_workbook($1,$2,$3,$4::jsonb) revision",
    [id(school), id(cls), rev, JSON.stringify(document)],
  );
}
await user(1);
let r = await save(0);
assert.equal(r.rows[0].revision, 1);
r = await save(1);
assert.equal(r.rows[0].revision, 2);
await assert.rejects(
  () => save(1),
  /workbook_conflict/,
  "stale writes must fail",
);
await assert.rejects(
  () => save(0, { ...doc, cells: {} }, 11, 21),
  /row-level security/,
  "cross-school write must fail",
);
const invalidVersion = structuredClone(doc);
delete invalidVersion.version;
await assert.rejects(() => save(2, invalidVersion), /invalid_workbook/);
await assert.rejects(
  () =>
    save(2, {
      ...doc,
      cells: { custom: { [id(31)]: { note: "Wrong class" } } },
    }),
  /workbook_learner_not_enrolled/,
);
await assert.rejects(
  () => save(2, { ...doc, cells: { custom: { [id(30)]: { score: "oops" } } } }),
  /invalid_cell_type/,
);
await assert.rejects(
  () =>
    save(2, { ...doc, cells: { custom: { [id(30)]: { officialMark: 80 } } } }),
  /invalid_cell/,
);
await assert.rejects(
  () =>
    save(2, {
      ...doc,
      sheets: [
        {
          ...doc.sheets[0],
          columns: [
            {
              id: "loop",
              label: "Loop",
              type: "formula",
              operation: "sum",
              sources: ["loop"],
            },
          ],
        },
      ],
      cells: {},
    }),
  /invalid_formula_source/,
);
await user(2);
r = await db.query("select * from public.teacher_class_workbooks");
assert.equal(r.rows.length, 0, "another teacher cannot read private cells");
await assert.rejects(
  () =>
    db.query("select public.teacher_get_class_workbook($1,$2)", [
      id(10),
      id(20),
    ]),
  /class_not_assigned/,
);
await user(3);
await assert.rejects(() => save(0), /row-level security/);
await db.exec("reset role;set role anon");
await assert.rejects(
  () => db.query("select * from public.teacher_class_workbooks"),
  /permission denied/,
);
await user(1);
const groupArgs = [id(10), id(20), "Revision", [id(30)], id(50)];
r = await db.query(
  "select public.teacher_create_workbook_group($1,$2,$3,$4,$5) id",
  groupArgs,
);
assert.equal(r.rows[0].id, id(50));
await db.query(
  "select public.teacher_create_workbook_group($1,$2,$3,$4,$5)",
  groupArgs,
);
r = await db.query("select * from public.class_group_members");
assert.equal(r.rows.length, 1, "group retries must not duplicate membership");
await assert.rejects(
  () =>
    db.query("select public.teacher_create_workbook_group($1,$2,$3,$4,$5)", [
      id(10),
      id(20),
      "Bad group",
      [id(31)],
      id(51),
    ]),
  /group_learner_not_enrolled/,
);
r = await db.query("select * from public.class_groups where id=$1", [id(51)]);
assert.equal(r.rows.length, 0, "failed group must not leave an orphan");
await db.exec(
  `reset role;update student_classes set is_current=false where student_id='${id(30)}'`,
);
await user(1);
r = await save(2);
assert.equal(
  r.rows[0].revision,
  3,
  "unchanged notes may be retained after transfer",
);
const changed = structuredClone(doc);
changed.cells.custom[id(30)].note = "Changed after transfer";
await assert.rejects(() => save(3, changed), /workbook_learner_not_enrolled/);
await db.exec(
  `reset role;delete from school_members where profile_id='${id(1)}'`,
);
await user(1);
r = await db.query("select * from public.teacher_class_workbooks");
assert.equal(
  r.rows.length,
  0,
  "revoked membership immediately hides saved workbook",
);
await assert.rejects(() => save(3), /workbook_conflict|row-level security/);
await db.close();
console.log(
  "Workbook database: real migration, RLS allow/deny, stale save, typed cells, transfer retention, membership revocation and atomic group retries passed.",
);
