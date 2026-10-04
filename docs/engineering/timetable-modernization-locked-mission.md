# Timetable modernization — locked mission

Owner instruction: preserve all existing timetable behavior; investigate and implement the discussed modern timetable, creation, assistance and independent lesson-planning scope; integrate through protected main only after verification.

Base inspected: `82f36cff29469fc4c4eeca6bc8ce55762b27996a`.
Mission: `CYBORG-20261004052050-116dc4`.
Status: IN PROGRESS / NOT CERTIFIED. This document is a checkpoint, not a release certificate.

## Binding requirements and checkpoint

| Requirement | Current state |
| --- | --- |
| Preserve existing daily timetable, drawer, teaching and recovery actions | Existing paths retained; browser regression proof pending |
| Connect familiar weekly sheet to the same canonical slots and lesson drawer | Implemented; server-rendering regressions pass |
| Show protected breaks, date-effective lessons and joined double lessons | Implemented; boundary and rendering regressions pass |
| Tap empty period to create | Implemented; partial occupied periods suppressed |
| Structured single/double/triple creation using configured school periods | Implemented; consecutive-period regressions pass |
| Preserve genuine custom school exceptions and explain unusual timings | Implemented; no unverified level duration mandated |
| Grade/education-level suggested defaults grounded in current official guidance | Pending research and reviewed setup design |
| School-day configuration with safe school-level permissions and preview | Pending |
| Guided first-use and later class setup | Inline guide and class setup link implemented; full setup journey pending |
| Teacher-accessible placement suggestions, preferred sessions, clash checks | Implemented through existing teacher-authorized conflict preview; browser proof pending |
| School-configured subject spread, resource, workload and morning preferences | Existing canonical intelligence retained; full UI reconciliation pending |
| Repeat weekly or create a single-date lesson | Implemented; browser/date regression proof pending |
| Preserve form during failures and block duplicate submissions | Implemented; async browser failure proof pending |
| View preference, mobile sheet navigation and print | Preference and print control implemented; Android/print proof pending |
| Copy/move/repeat week with conflict revalidation | Existing edit retained; additional copy/repeat flow pending |
| Undo with concurrency-safe server semantics | Pending; destructive deletion remains existing confirmed behavior |
| Effective-date revisions and today-only changes preserve lesson history | Existing recovery/effective range paths retained; complete journey proof pending |
| Multi-school clash checking | Pending cross-school canonical reconciliation |
| Preparation status and connected teaching actions from sheet | Existing drawer reused; preparation badges pending |
| Holidays/exams/events/substitutions | Existing domain code inspected; teacher UI/reconciliation pending |
| Independent lesson creation from Lessons, Scheme and Subject | Pending schema, repository and UI work; live lesson_plans.timetable_slot_id is NOT NULL |
| Reusable plan to dated lesson attachment without sharing evidence | Pending design and integrity proof |
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
