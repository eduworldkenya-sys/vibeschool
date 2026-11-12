import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source=fs.readFileSync('lib/timetable/schoolPublication.ts','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText
const {effectivePublishedSchoolReleases:resolve,belongsToPublishedSchoolSlot:belongs}=
  await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))

const rows=[
  {id:'review',school_id:'school-a',label:'Draft',status:'review',effective_from:'2026-11-01',published_at:null},
  {id:'future',school_id:'school-a',label:'Future',status:'published',effective_from:'2027-01-01',published_at:'2026-11-11T00:00:00Z'},
  {id:'official',school_id:'school-a',label:'School A',status:'published',effective_from:'2026-11-10',published_at:'2026-11-11T00:00:00Z'},
  {id:'other',school_id:'school-b',label:'School B',status:'published',effective_from:'2026-11-10',published_at:'2026-11-11T00:00:00Z'},
  {id:'retired',school_id:'school-a',label:'Prior',status:'retired',effective_from:'2026-10-01',published_at:'2026-10-02T00:00:00Z'},
  {id:'unauth',school_id:'school-z',label:'Unknown',status:'published',effective_from:'2026-11-10',published_at:'2026-11-11T00:00:00Z'},
  {id:'unmarked',school_id:'school-a',label:'Unpublished',status:'published',effective_from:'2026-11-07',published_at:null},
]
const a=resolve(rows,['school-a','school-b'],'2026-11-16')
assert.deepEqual(Object.keys(a).sort(),['school-a','school-b'])
assert.equal(a['school-a'].id,'official')
assert.equal(a['school-b'].id,'other')
assert.equal(resolve(rows,['school-a'],'2026-11-05')['school-a'],undefined)
assert.equal(resolve(rows,[],'2026-11-16')['school-a'],undefined)
assert.equal(belongs('school-a','official',a),true)
assert.equal(belongs('school-a','review',a),false)
assert.equal(belongs('school-a',null,a),false)
assert.equal(belongs('school-b','official',a),false)
assert.equal(belongs('school-z','unauth',a),false)

const page=fs.readFileSync('app/teacher/timetable/page.tsx','utf8')
const engine=fs.readFileSync('lib/timetable/engine.ts','utf8')
const admin=fs.readFileSync('app/admin/timetable/page.tsx','utf8')
const panel=fs.readFileSync('components/admin/SchoolTimetablePublicationPanel.tsx','utf8')
const operations=fs.readFileSync('lib/timetable/operations.ts','utf8')
const sql=fs.readFileSync('supabase/migrations/20261112210000_school_timetable_publication_authority.sql','utf8')
assert.match(page,/from\('timetable_releases'\)/,'published releases read from canonical table')
assert.match(page,/\.eq\('status','published'\)/,'draft/review cannot look official')
assert.match(page,/effectivePublishedSchoolReleases/,'verified membership projection used')
assert.match(page,/releaseId: publishedBySchool\[membershipSchoolId\]\.id/,'slot loads bound to exact published release')
assert.match(engine,/query = query\.eq\("release_id", releaseId\)/,'query must filter server-side')
assert.match(page,/belongsToPublishedSchoolSlot\(row\.school_id,row\.release_id,publishedBySchool\)/,'substitutions must use published originals')
assert.match(page,/schoolAdminCanManage && !!activeSchoolId && !officialReleases\[activeSchoolId\]/,'official timetable cannot be edited')
assert.match(page,/canEdit=\{Boolean\(canAddSlot/,'drawer edit permission must match school management')
assert.match(page,/canCopy=\{Boolean\(canAddSlot/,'no official slot copy from teacher drawer')
assert.match(page,/School timetable not yet published/,'no silent default from historical/test slots')
assert.match(page,/prepare and teach unscheduled lessons/,'absence of school schedule never blocks unscheduled prep')
assert.match(panel,/school_timetable_release_preflight/,'UI cannot rely on local unchecked validation')
assert.match(panel,/updateTimetableReleaseStatus/,'existing release transitions must be reused')
assert.match(panel,/window\.confirm/,'publication needs explicit admin confirmation')
assert.match(panel,/Return to draft/,'reviewed timetable can be corrected before approval')
assert.match(panel,/Return to review/,'approved timetable can be reopened for review')
assert.match(operations,/Draft is also a valid REVIEW/,'draft correction must use governed transition')
assert.match(panel,/gate\.release_id!==current\.id/,'stale release readiness cannot authorise another release')
assert.match(admin,/SchoolTimetablePublicationPanel/,'admin controls embedded in canonical admin page')
assert.match(admin,/releaseFrom<nairobiDateStr\(\)/,'no past-effective administrative publication')
assert.match(sql,/create or replace function public\.school_timetable_release_preflight/,'server authority is compulsory')
assert.match(sql,/public\.is_school_admin\(v\.school_id\)/,'server enforces school admin role')
assert.match(sql,/v_invalid_periods=0/,'publication rejects unconfirmed periods')
assert.match(sql,/v_invalid_assignments=0/,'publication rejects unsupported teacher assignments')
assert.match(sql,/v_missing_allocations=0/,'publication rejects missing allocation targets')
assert.match(sql,/v_bad_allocations=0/,'publication rejects KICD allocation gaps')
assert.match(sql,/v_uncovered_classes=0/,'school-wide timetable cannot exclude allocated school classes')
assert.match(panel,/uncovered_school_class_count/,'administrator sees uncovered classes before approval')
assert.match(sql,/RELEASE_ACTIVATION_DATE_REQUIRED/,'future-approved release cannot retire active timetable early')
assert.match(sql,/v_unreleased=0/,'cannot claim partial release is whole school')
assert.match(sql,/pg_advisory_xact_lock/,'concurrent publishing serialized by school')
assert.match(sql,/unique index if not exists timetable_releases_one_published_school/,'enforce single active release per school in the database')
assert.match(sql,/PUBLISHED_SLOT_IMMUTABLE/,'published slot identity protected')
assert.match(sql,/APPROVED_SLOT_LOCKED/,'approved release may not be altered without returning to review')
assert.match(sql,/revoke insert,update,delete on table public\.timetable_releases from authenticated/,'admins cannot bypass transition by direct table write')
assert.match(sql,/create or replace function public\.create_school_timetable_release/,'draft creation must use atomic server routine')
assert.match(operations,/rpc\("create_school_timetable_release"/,'client must not directly insert releases')
assert.doesNotMatch(operations,/from\("timetable_releases"\)\.insert/,'direct ungoverned insert is prohibited')
assert.match(sql,/public\.is_active_school_member\(ts\.school_id\)/,'old published teacher reader membership guarded')
assert.doesNotMatch(sql,/insert\s+into\s+public\.school_periods/i,'migration may not invent school bell times')
assert.doesNotMatch(sql,/insert\s+into\s+public\.teaching_occurrences/i,'publishing cannot create teaching evidence')
console.log('PASS: school-authoritative publication, no fake defaults, no unapproved lessons or access bypass')
