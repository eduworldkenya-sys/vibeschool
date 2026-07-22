VIBESCHOOL TIMETABLE FIX REGISTER

Purpose

This file is the permanent source of truth for timetable repair and implementation work.

Claude Code must:

- work from the current repository state;
- inspect the current Supabase project directly;
- use git history and repository files as evidence;
- complete one fix unit at a time;
- update "HANDOVER.md" at the end of every fix;
- never restart the full audit unless explicitly instructed.

The active fix is recorded in "HANDOVER.md".

---

EXECUTION MODEL

One fix per session

Each Claude Code session works on exactly one fix ID.

A fix may end only as:

- "VERIFIED"
- "BLOCKED"
- "FAILED"
- "AWAITING_APPROVAL"

Claude must not silently continue into the next fix.

---

PERMANENT EXECUTION LOOP

1. Load project state

Read:

1. "CLAUDE.md"
2. "TIMETABLE_FIX_REGISTER.md"
3. "HANDOVER.md"
4. Relevant source files
5. Relevant migrations
6. Current git status and recent commits
7. Current Supabase schema and migration ledger

Confirm the active fix before changing anything.

---

2. Confirm prior state

Verify that all declared prerequisite fixes are present in:

- repository files;
- git history;
- migration files;
- Supabase schema;
- Supabase migration ledger;
- relevant application behaviour.

Do not assume that a printed handover is correct if the repository or database contradicts it.

---

3. Scope the active fix

Work only on the active fix ID.

Do not:

- restart a broad audit;
- fix unrelated findings;
- redesign adjacent systems;
- clean unrelated code;
- combine another fix into the current session;
- change existing conventions without approval.

Unrelated findings must be added to "HANDOVER.md" under "NEW FINDINGS", not fixed.

---

4. Trace the full path

Trace the relevant path end to end:

UI
→ component
→ route or server action
→ data service
→ RPC
→ database tables
→ constraints
→ triggers
→ functions
→ RLS
→ grants
→ existing data
→ downstream consumers

Do not modify code until the exact root cause is demonstrated.

---

5. Prove the defect

Record evidence showing:

- what is wrong;
- where it is wrong;
- why it happens;
- which users or flows are affected;
- whether the defect is in code, schema, data, migration history, permissions, or multiple layers.

Do not treat symptoms as root cause.

---

6. Design the smallest complete fix

The fix must:

- address the proven root cause;
- preserve the current architecture unless the architecture itself is defective;
- avoid duplicate logic;
- avoid hidden fallback behaviour;
- preserve tenant isolation;
- preserve history where required;
- remain safe under retries and concurrent requests;
- include all required code, schema, data, RLS, and verification changes.

---

7. Preflight

Before implementation, check:

- working tree state;
- unrelated uncommitted edits;
- migration version availability;
- migration ledger status;
- target Supabase project;
- target environment;
- existing affected data;
- constraints that may reject current data;
- dependent functions, triggers, policies, grants, views, and application code;
- rollback or recovery path.

Never overwrite unrelated in-flight work.

---

8. Implement

Apply only the changes required for the active fix.

Requirements:

- use migrations for database changes;
- do not make undocumented production-only schema changes;
- keep repository migrations and live schema synchronized;
- use canonical project imports and conventions from "CLAUDE.md";
- avoid direct table writes when an approved secured RPC is required;
- preserve or improve type safety;
- keep the change reviewable as one coherent unit.

---

9. Verify

Verification is mandatory.

Depending on the fix, verify:

- TypeScript;
- build;
- lint or repository health checks;
- migration syntax;
- clean migration replay;
- live schema state;
- constraints;
- triggers;
- functions;
- RPC inputs and outputs;
- RLS;
- grants;
- authorized access;
- unauthorized access;
- cross-school isolation;
- valid edge cases;
- invalid edge cases;
- retry behaviour;
- concurrency behaviour;
- downstream timetable consumers;
- regression against previously verified fixes.

A successful TypeScript check alone is not proof of a complete fix.

---

10. Close the fix

Update:

1. this register;
2. "HANDOVER.md";
3. relevant tests or validation scripts;
4. git commit history.

A fix is "VERIFIED" only when evidence proves the required outcome.

---

DATABASE SAFETY POLICY

Environment classification

Before any database write, Claude must identify the connected project as one of:

- "LOCAL"
- "BRANCH"
- "STAGING"
- "PRODUCTION"
- "UNKNOWN"

If the environment is "UNKNOWN", no database write is allowed.

---

Production restrictions

The following actions must never run against production without explicit approval in the current session:

- "supabase db reset";
- destructive schema rebuild;
- dropping tables;
- dropping columns;
- dropping RLS policies;
- disabling RLS;
- dropping functions used by the application;
- dropping triggers;
- migration ledger repair;
- migration history deletion;
- destructive data cleanup;
- bulk updates or deletes;
- constraint additions that can lock or reject existing production data;
- baseline application;
- synthetic migration registration;
- rollback of applied migrations.

For these operations Claude must:

1. show the exact proposed SQL or command;
2. identify the target environment and project reference;
3. explain the impact;
4. show preflight evidence;
5. show rollback or recovery steps;
6. stop with "AWAITING_APPROVAL".

Approval for one command does not approve later commands.

---

Non-production destructive work

On a local, branch, or staging environment, destructive work is allowed only when:

- the environment has been positively identified;
- the purpose is directly related to the active fix;
- the action is recorded in "HANDOVER.md";
- the result is verified;
- production is not affected.

---

STATUS DEFINITIONS

OPEN

The fix has not started.

IN PROGRESS

The fix is currently being investigated or implemented.

AWAITING APPROVAL

The next required action is destructive, production-affecting, or explicitly approval-gated.

BLOCKED

The fix cannot continue because of a confirmed dependency or unavailable access.

FAILED

Implementation or verification failed and the repository or database has not reached the required result.

VERIFIED

The root cause was corrected and all required verification passed.

---

PHASE 0 — MIGRATION AND REBUILD SAFETY

ID| Priority| Status| Fix unit| Required result
TBL-001| P0| VERIFIED| Repair malformed and misversioned migration filenames| Local migration version keys match the intended live ledger keys for all affected files
TBL-002| P0| OPEN| Classify every migration| Every local and remote migration has exactly one explicit classification
TBL-003| P0| OPEN| Correct pending migration handling| Pending migrations are declared and excluded from false parity failures
TBL-004| P0| VERIFIED| Strengthen baseline guards| N/A -- no replayable SYNTHETIC_BASELINE migration exists in the repository
TBL-004 closed as N/A: the sole SYNTHETIC_BASELINE entry, 20260520000000_timetable_foundation_baseline, is live-only and has no repository SQL file. No replayable baseline exists to guard.
TBL-005| P0| OPEN| Add data preconditions for constraints| Invalid production data is detected before constraints are applied
TBL-006| P0| OPEN| Build forward-collision register| Every later migration touching baseline-owned objects is identified and resolved
TBL-007| P0| OPEN| Gate migration repair behind preflight| Repair cannot run without validated unchanged inputs
TBL-008| P0| OPEN| Make postflight executable| Local and remote migration state is automatically compared
TBL-009| P0| OPEN| Align fallback repair path| Primary and fallback repair methods produce identical ledger state
TBL-010| P0| OPEN| Recover required core RLS policies| Clean rebuild preserves intended access rules
TBL-011| P0| OPEN| Run isolated clean rebuild| Full migration chain succeeds from blank state
TBL-012| P0| OPEN| Compare rebuilt schema with target schema| No unexplained timetable schema difference remains
TBL-013| P0| OPEN| Repair live migration history| Approved ledger reconciliation is applied safely
TBL-014| P0| OPEN| Commit reconciliation checkpoint| Migration recovery is preserved in an isolated clean checkpoint

---

PHASE 1 — TIMETABLE INTEGRITY AND SECURITY

ID| Priority| Status| Fix unit| Required result
TBL-015| P0| OPEN| Remove legacy overlap trigger| One canonical conflict mechanism remains
TBL-016| P0| OPEN| Fix occurrence write RLS| Unauthorized and cross-school occurrence writes fail
TBL-017| P0| OPEN| Revoke unsafe anonymous function execution| Anonymous execution is denied for timetable functions
TBL-018| P0| OPEN| Fix ambiguous scheme coverage function| Scheme coverage function executes without ambiguous references
TBL-019| P0| OPEN| Enforce slot school identity| Every slot has a valid and consistent school
TBL-020| P0| OPEN| Enforce class foreign key| Orphan timetable class references are impossible
TBL-021| P0| OPEN| Enforce subject foreign key| Every slot has a valid subject ID
TBL-022| P0| OPEN| Enforce teacher assignment contract| Only assigned teacher-class-subject combinations can be scheduled
TBL-023| P0| OPEN| Remove nullable assignment class| Every teacher assignment has a valid class
TBL-024| P0| OPEN| Normalize day-of-week domain| Database and application use one day representation
TBL-025| P0| OPEN| Add configurable school operating days| Weekend behaviour follows school configuration
TBL-026| P0| OPEN| Validate slot time range| Zero-length and reversed slots are rejected
TBL-027| P0| OPEN| Validate effective-date range| Invalid effective periods are rejected
TBL-028| P0| OPEN| Enforce room conflict integrity| Active room overlaps cannot be committed
TBL-029| P0| OPEN| Enforce teacher conflict integrity| Active teacher overlaps cannot be committed
TBL-030| P0| OPEN| Enforce class conflict integrity| Active class overlaps cannot be committed

---

PHASE 2 — CANONICAL TIMETABLE DATA LAYER

ID| Priority| Status| Fix unit| Required result
TBL-031| P0| OPEN| Create canonical active-slot reader| All timetable consumers use one authoritative reader
TBL-032| P0| OPEN| Centralize effective-date filtering| Future and expired slots are handled consistently
TBL-033| P0| OPEN| Fix student timetable filtering| Students see only valid active slots
TBL-034| P0| OPEN| Fix student dashboard filtering| Dashboard and timetable results match
TBL-035| P0| OPEN| Align Pulse timetable reading| Pulse uses canonical timetable context
TBL-036| P1| OPEN| Align Attendance timetable reading| Attendance uses exact dated teaching context
TBL-037| P1| OPEN| Align Lesson Plan timetable reading| Same-day lessons remain distinct
TBL-038| P1| OPEN| Align Subject Hub timetable reading| Subject Hub matches canonical timetable state
TBL-039| P1| OPEN| Align Scheme generator timetable reading| Scheme pacing uses canonical schedule data
TBL-040| P1| OPEN| Align Smart Preview rules| Preview and saved schedules use identical validation
TBL-041| P1| OPEN| Create canonical timetable TypeScript contracts| Duplicate slot interfaces are removed
TBL-042| P1| OPEN| Create canonical timezone service| All surfaces use school timezone consistently
TBL-043| P1| OPEN| Fix midnight rollover| Long-running pages update day state correctly
TBL-044| P1| OPEN| Fix weekend day selection and labels| "Today" and next-day logic remain correct every day

---

PHASE 3 — SLOT CREATION AND MANAGEMENT

ID| Priority| Status| Fix unit| Required result
TBL-045| P0| OPEN| Replace class ownership lookup| Add Slot uses "teacher_classes" obligations
TBL-046| P0| OPEN| Remove subject label matching| Subject identity is ID-based
TBL-047| P0| OPEN| Route creation through one secured RPC| Direct slot inserts are eliminated
TBL-048| P0| OPEN| Return structured conflict errors| UI identifies teacher, class, or room conflict precisely
TBL-049| P1| OPEN| Add slot editing| Existing schedules can be edited safely
TBL-050| P1| OPEN| Add slot expiration| Schedule revisions preserve history
TBL-051| P1| OPEN| Add controlled slot deletion| Unused erroneous slots can be deleted securely
TBL-052| P1| OPEN| Distinguish expiration from deletion| Historical slots are not accidentally destroyed
TBL-053| P1| OPEN| Implement effective-dated slot revision| Past and future schedule states remain correct
TBL-054| P1| OPEN| Complete timetable duplication flow| Copies are conflict-checked before persistence
TBL-055| P1| OPEN| Add timetable change audit data| Slot changes identify actor, time, and reason
TBL-056| P1| OPEN| Strengthen Add Slot client validation| Invalid identity payloads never reach the server
TBL-057| P1| OPEN| Prevent repeated submissions| Rapid taps create one result
TBL-058| P1| OPEN| Add actionable zero-slot state| Unscheduled obligations remain visible
TBL-059| P2| OPEN| Correct timetable action labels| UI distinguishes a timetable slot from a lesson

---

PHASE 4 — DATED TEACHING OCCURRENCES

ID| Priority| Status| Fix unit| Required result
TBL-060| P0| OPEN| Define occurrence generation rules| Term, holiday, closure, and cancellation behaviour is deterministic
TBL-061| P0| OPEN| Make occurrence generation idempotent| Repeated generation cannot create duplicates
TBL-062| P0| OPEN| Respect academic term boundaries| Occurrences are generated only inside valid terms
TBL-063| P0| OPEN| Respect school holidays| Holidays do not create ordinary teaching occurrences
TBL-064| P1| OPEN| Support school closures| Closure dates are classified without false missed lessons
TBL-065| P1| OPEN| Support teacher absence| Absence creates the correct recovery state
TBL-066| P1| OPEN| Support substitute teaching| Scheduled and actual teacher identities are preserved
TBL-067| P0| OPEN| Wire Start Lesson| Current slot opens or creates one dated occurrence
TBL-068| P0| OPEN| Wire occurrence completion| A taught lesson closes through a valid lifecycle transition
TBL-069| P1| OPEN| Add occurrence cancellation| Cancelled lessons remain auditable
TBL-070| P1| OPEN| Add occurrence rescheduling| Recovery event remains linked to the original
TBL-071| P1| OPEN| Allow standalone recovery occurrences| Recovery can occur outside the original recurring slot
TBL-072| P1| OPEN| Display occurrence lifecycle status| Teacher sees scheduled, active, completed, cancelled, and missed states
TBL-073| P1| OPEN| Prevent duplicate lesson plans per occurrence| Repeated actions do not create duplicate plans
TBL-074| P1| OPEN| Link occurrence to lesson plan| Lesson plan belongs to an exact dated lesson
TBL-075| P1| OPEN| Link occurrence to attendance| Attendance belongs to an exact dated lesson
TBL-076| P1| OPEN| Link occurrence to homework| Homework traces back to the taught lesson
TBL-077| P1| OPEN| Link occurrence to evidence| Evidence traces back to the taught lesson
TBL-078| P1| OPEN| Link occurrence to reflection| Reflection belongs to one completed lesson
TBL-079| P1| OPEN| Update scheme coverage on completion| Real teaching advances the exact scheme item
TBL-080| P1| OPEN| Prevent premature scheme coverage| Scheduled or incomplete lessons do not count as covered
TBL-081| P1| OPEN| Define evidence requirement behaviour| Completion rules remain configurable and explicit
TBL-082| P1| OPEN| Make lifecycle transitions retry-safe| Retried requests reach one consistent state

---

PHASE 5 — TERM, PERIOD, AND SCHOOL CALENDAR

ID| Priority| Status| Fix unit| Required result
TBL-083| P1| OPEN| Bind slots to school period grid| Configured periods are canonical
TBL-084| P1| OPEN| Support custom-time schools| Schools without periods can still schedule safely
TBL-085| P1| OPEN| Display breaks and free periods| Timetable reflects the complete school day
TBL-086| P1| OPEN| Fix national term-week fallback| National rows work when "school_id" is null
TBL-087| P1| OPEN| Prefer school-specific calendar override| School calendar correctly overrides national defaults
TBL-088| P1| OPEN| Centralize active-term resolution| All modules resolve the same term and week
TBL-089| P1| OPEN| Handle invalid active-term state| Missing or multiple active terms fail explicitly
TBL-090| P2| OPEN| Handle term rollover| New terms preserve history and activate correctly

---

PHASE 6 — ALLOCATION AND WORKLOAD INTELLIGENCE

ID| Priority| Status| Fix unit| Required result
TBL-091| P1| OPEN| Load zero-slot teaching obligations| Assigned but unscheduled subjects are visible
TBL-092| P1| OPEN| Connect weekly allocations| Required and scheduled weekly counts are available
TBL-093| P1| OPEN| Detect under-allocation| Missing periods are listed
TBL-094| P1| OPEN| Detect over-allocation| Excess periods are listed
TBL-095| P1| OPEN| Define timetable completeness| Completion requires every obligation to be addressed
TBL-096| P1| OPEN| Add distribution quality checks| Poorly distributed lessons produce deterministic warnings
TBL-097| P2| OPEN| Support double-period rules| Consecutive-period requirements are enforced
TBL-098| P2| OPEN| Add teacher workload capacity| Overloaded teachers are identified
TBL-099| P2| OPEN| Add class workload quality| Unbalanced learner schedules are identified
TBL-100| P2| OPEN| Add room capacity and type rules| Unsuitable room assignments are blocked or warned
TBL-101| P2| OPEN| Add teacher scheduling preferences| Preferences affect soft scoring only
TBL-102| P2| OPEN| Separate hard and soft constraints| Mandatory conflicts can never be suggested
TBL-103| P2| OPEN| Build explainable suggestion scoring| Every suggestion includes clear scoring reasons
TBL-104| P2| OPEN| Add atomic suggestion acceptance| Server revalidates before saving
TBL-105| P2| OPEN| Add generated timetable rollback| Applied suggestions can be reverted safely
TBL-106| P2| OPEN| Validate snapshot restoration| Old snapshots cannot bypass current rules

---

PHASE 7 — TEACHER OS INTEGRATION

ID| Priority| Status| Fix unit| Required result
TBL-107| P1| OPEN| Make timetable drawer ID-first| Downstream routes receive stable IDs
TBL-108| P1| OPEN| Add Teach Now primary action| Teacher enters the current teaching workflow directly
TBL-109| P1| OPEN| Add occurrence-aware Attendance action| Correct class and lesson context loads automatically
TBL-110| P1| OPEN| Add occurrence-aware Lesson Plan action| Exact lesson plan loads
TBL-111| P1| OPEN| Add occurrence-aware Homework action| Homework links to the taught lesson
TBL-112| P1| OPEN| Add Evidence action| Evidence attaches to the current occurrence
TBL-113| P1| OPEN| Add Reflection action| Reflection follows completed teaching
TBL-114| P1| OPEN| Add next-lesson chaining| Teacher can continue to the next scheme item
TBL-115| P1| OPEN| Drive Pulse from occurrence state| Pulse reflects real dated teaching
TBL-116| P1| OPEN| Add missed-lesson recovery queue| Missed teaching remains visible until resolved
TBL-117| P1| OPEN| Feed missed teaching into pacing| Scheme pacing reflects recovery risk
TBL-118| P2| OPEN| Build teacher daily timeline| Day view shows upcoming, active, and completed teaching
TBL-119| P2| OPEN| Centralize current and next lesson logic| Every surface agrees on lesson priority
TBL-120| P2| OPEN| Build completed lesson summary| Attendance, evidence, homework, and reflection form one record

---

PHASE 8 — UI AND USABILITY

ID| Priority| Status| Fix unit| Required result
TBL-121| P1| OPEN| Build desktop week grid| Full timetable remains readable on desktop
TBL-122| P1| OPEN| Build mobile day timeline| Timetable is fully usable on a phone
TBL-123| P1| OPEN| Visualize overlaps and validation errors| Conflict type and location are obvious
TBL-124| P1| OPEN| Show active, future, and expired revisions| Schedule lifecycle is visible
TBL-125| P1| OPEN| Show unscheduled obligations| Missing teaching periods are actionable
TBL-126| P2| OPEN| Standardize room, period, and time display| Operational details are consistently visible
TBL-127| P2| OPEN| Improve loading states| Loading never appears as a broken page
TBL-128| P2| OPEN| Improve recoverable errors| Errors provide useful retry or correction actions
TBL-129| P2| OPEN| Add safe offline timetable reads| Current timetable remains viewable during connectivity loss
TBL-130| P2| OPEN| Protect against stale writes| Concurrent edits are detected
TBL-131| P2| OPEN| Improve accessibility| Colour, labels, focus, and touch targets remain usable
TBL-132| P2| OPEN| Standardize timetable terminology| Slot, period, lesson, and occurrence are used consistently

---

PHASE 9 — RELIABILITY AND TESTING

ID| Priority| Status| Fix unit| Required result
TBL-133| P0| OPEN| Add timetable database integrity tests| Invalid schedule rows fail predictably
TBL-134| P0| OPEN| Add timetable RLS tests| Unauthorized and cross-school access fails
TBL-135| P1| OPEN| Add RPC contract tests| Inputs, outputs, and error codes remain stable
TBL-136| P1| OPEN| Add slot lifecycle tests| Create, edit, revise, expire, and delete remain correct
TBL-137| P1| OPEN| Add occurrence lifecycle tests| Every state transition is tested
TBL-138| P1| OPEN| Add consumer consistency tests| All timetable surfaces return matching identities
TBL-139| P1| OPEN| Add timezone boundary tests| Midnight, weekend, and term-edge behaviour is correct
TBL-140| P1| OPEN| Add allocation calculation tests| Zero, under, exact, and over allocation remain correct
TBL-141| P1| OPEN| Add migration reset CI| Every migration change proves clean rebuild
TBL-142| P1| OPEN| Add schema drift detection| Untracked live schema changes are detected
TBL-143| P1| OPEN| Add structured RPC error logging| Production failures can be traced
TBL-144| P1| OPEN| Add conflict analytics| Repeated scheduling failures can be diagnosed
TBL-145| P2| OPEN| Add timetable query performance checks| Key reads remain within acceptable limits
TBL-146| P2| OPEN| Add atomic batch-operation tests| Partial batch state cannot remain
TBL-147| P2| OPEN| Add timetable backup recovery procedure| Timetable state can be restored
TBL-148| P2| OPEN| Add timetable release checklist| Every release has recorded verification evidence

---

PHASE 10 — ADMINISTRATION

ID| Priority| Status| Fix unit| Required result
TBL-149| P2| OPEN| Add school period administration| Authorized admin can configure periods and breaks
TBL-150| P2| OPEN| Add operating-day administration| School teaching days are configurable
TBL-151| P2| OPEN| Add room administration| Rooms have valid identity, type, and capacity
TBL-152| P2| OPEN| Add weekly allocation administration| Required subject counts are configurable
TBL-153| P2| OPEN| Add timetable approval workflow| Draft, review, approval, and publication are distinct
TBL-154| P2| OPEN| Add publish effective date| Schedule versions activate predictably
TBL-155| P2| OPEN| Add school-wide conflict dashboard| Global teacher, class, and room conflicts are visible
TBL-156| P2| OPEN| Add teacher workload dashboard| Administration can see load balance
TBL-157| P2| OPEN| Add timetable revision notifications| Affected users receive meaningful change notifications
TBL-158| P3| OPEN| Add parent timetable visibility| Parents see the published learner timetable

---

FIX REPORT FORMAT

At the close of every fix, Claude must update "HANDOVER.md" with:

FIX ID:
STATUS:

OBJECTIVE:

ROOT CAUSE:

EVIDENCE:

FILES CHANGED:

DATABASE OBJECTS CHANGED:

MIGRATION:

DATA CHANGES:

RLS AND SECURITY:

VERIFICATION COMMANDS:

VERIFICATION RESULTS:

REGRESSION RESULTS:

UNRELATED CHANGES PRESERVED:

NEW FINDINGS:

OPEN RISKS:

COMMIT:

NEXT FIX:

---

SESSION START INSTRUCTION

A new Claude Code session should receive only:

Read CLAUDE.md, TIMETABLE_FIX_REGISTER.md, and HANDOVER.md.

Continue only the active fix recorded in HANDOVER.md.

Follow the permanent execution loop.

Do not begin another fix.

Do not run destructive production database operations without explicit approval.
