# Timetable modernization — locked mission

Owner instruction: preserve all existing timetable behavior; investigate and implement the discussed modern timetable, creation, assistance and independent lesson-planning scope; integrate through protected main only after verification.

Base inspected: `82f36cff29469fc4c4eeca6bc8ce55762b27996a`.
Mission: `CYBORG-20261004052050-116dc4`.
Status: CLOSURE CANDIDATE / NOT CERTIFIED. The remaining modernization scope is implemented on the closure branch; exact-head CI, production migration, browser/mobile/print and live postflight remain release gates.

## Binding requirements and checkpoint

| Requirement | Current state |
| --- | --- |
| Preserve existing daily timetable, drawer, teaching and recovery actions | Existing paths retained; browser regression proof pending |
| Connect familiar weekly sheet to the same canonical slots and lesson drawer | Implemented; server-rendering regressions pass |
| Show protected breaks, date-effective lessons and joined double lessons | Implemented; boundary and rendering regressions pass |
| Tap empty period to create | Implemented; partial occupied periods suppressed |
| Structured single/double/triple creation using configured school periods | Implemented; consecutive-period regressions pass |
| Preserve genuine custom school exceptions and explain unusual timings | Implemented; no unverified level duration mandated |
| Grade/education-level suggested defaults grounded in current official guidance | Reframed safely: school-owned grade duration defaults implemented; no unverified national duration rule is imposed |
| School-day configuration with safe school-level permissions and preview | Implemented in closure candidate with member read, school-admin write, overlap protection and in-use deletion guard |
| Guided first-use and later class setup | Inline guide and class setup link implemented; full setup journey pending |
| Teacher-accessible placement suggestions, preferred sessions, clash checks | Implemented through existing teacher-authorized conflict preview; browser proof pending |
| School-configured subject spread, resource, workload and morning preferences | Existing canonical intelligence retained; full UI reconciliation pending |
| Repeat weekly or create a single-date lesson | Implemented; browser/date regression proof pending |
| Preserve form during failures and block duplicate submissions | Implemented; async browser failure proof pending |
| View preference, mobile sheet navigation and print | Preference and print control implemented; Android/print proof pending |
| Copy/move/repeat week with conflict revalidation | Implemented in closure candidate: edit/move retained, lesson copy added, next-week revision exposed through canonical duplicate authority |
| Undo with concurrency-safe server semantics | Implemented in closure candidate using pre-change snapshots and history-preserving restore; multi-school snapshot bug repaired |
| Effective-date revisions and today-only changes preserve lesson history | Existing recovery/effective range paths retained; complete journey proof pending |
| Multi-school clash checking | Implemented in closure candidate: all authorized school schedules are combined for teacher visibility while canonical teacher overlap remains the write gate |
| Preparation status and connected teaching actions from sheet | Implemented in closure candidate with Ready / Needs review / Plan needed indicators |
| Holidays/exams/events/substitutions | Implemented in closure candidate: calendar exceptions surfaced; absence/substitute authority reconciled; substitute slots remain occurrence-scoped and non-editable |
| Independent lesson creation from Lessons, Scheme and Subject | Implemented without weakening occurrence identity: independent lesson_plan_drafts plus explicit attachment to a dated timetable occurrence |
| Reusable plan to dated lesson attachment without sharing evidence | Implemented in closure candidate; attachment copies planning content only and keeps attendance/evidence/delivery lineage occurrence-specific |
| Exact-head CI, independent assurance, main merge and post-merge verification | Pending; do not merge this checkpoint as complete mission |

## Verified findings

1. ClassicTimetable existed but was disconnected from the teacher timetable page.
2. AddSlotModal defaulted to an arbitrary 60-minute interval and never loaded school periods.
3. Existing suggestion RPC is admin-only in repository SQL and absent in the inspected production database. Teacher suggestions now use the current teacher-authorized conflict preview; no grant or RLS expansion was made.
4. Persisting period_id for new slots breaks the existing edit RPC, which cannot change period linkage. Guided creation validates times while preserving the existing nullable period-link contract.
5. The timetable test command could not resolve extensionless TypeScript under Node 24. The local test loader resolves TypeScript/TSX and the existing app alias without changing application emission or adding dependencies.
6. Independent review exposed stale suggestions, partial-period creation and overlap-rowspan issues. Repairs and regression proof are retained in the candidate.
7. Live inspection confirms the lesson-plan restriction is enforced by schema and application repository authority, not only UI.

## Verification and release obligations

Typecheck, targeted lint, timetable unit/intelligence/server-rendering tests and full build are local gates. Existing lint warnings are not described as zero-warning certification. SSR is not Android/browser/print verification. The broad mission remains open until every requirement above is resolved and protected exact-head checks and fresh independent assurance authorize integration.

No production writes, migrations, runtime or scheduler activation performed. Vercel configuration disables feature-branch deployments; preserve that budget protection.
