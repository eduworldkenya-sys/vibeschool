# Canonical Class OS integration

## User outcome
A teacher opens a class once and moves between the same roster, sheets, groups,
classroom activities, learner story, evidence, comparisons and next actions.
Student identity remains `students.id`; current membership remains
`student_classes`; teacher authority remains `teacher_classes` plus
`school_members` and the operating-context RPC.

## Reconciled source lineage
- Main baseline: `ec62ab2781c3dbb8f170a2ec3e77e4298b9d1a72`.
- PR #716 source: `c55f8fae360465678d06ab6022206b233b94b4c7`.
- Workbook source: `b8197fa494bddeb15ac6162f25f8ce7dc442ccc1`.
- Workbook source worktree is preserved. Integration edits occur in a separate
  worktree, with a snapshot/branch ownership decision in the mission journal.
- Workbook migration keeps its canonical source filename. The integration
  migration follows it chronologically and repairs shared functions forward.

## Delivered requirements and their purpose
| Requirement | Contract | Direct verification |
| --- | --- | --- |
| Sheets | Private custom fields and saved views; academic data projected from its existing domains | Workbook model, SQL and DOM suites |
| Bulk roster import | CSV/Excel/paste preview, optional admission, immutable request receipts and read-back; never identify learners by row order | Roster model and SQL retry tests |
| Groups and games | Static/smart/temporary groups, performance-grounded grouping, saved assignment snapshots, atomic scoreboard start/reset | Class OS contract and integrated SQL tests |
| Learner corrections | Name/optional demographics, optimistic edit check, admission collision lock, audit action | Integrated SQL stale-edit and collision tests |
| Move/leave/restore | Class teachers only; same-school authorised destination; preserve student ID and all historic evidence; block conflicting restore | Integrated SQL lifecycle and denial tests |
| Classroom observations | Atomic, retry-safe selected-learner actions; private by default; due follow-ups can be closed | Integrated SQL and workspace DOM tests |
| Questions and comparisons | Explicit supported questions, comparable released assessments, missing evidence stays unknown, coverage shown for cohort comparisons | Workspace model and DOM tests |
| Classroom tools | Non-repeating picker, private saved seating sheet, seat swaps, printable/exportable existing sheets | Workspace model and DOM tests |
| Activity history | Projection of existing attendance, submissions, released assessment and teacher-event domains; no parallel event store | Workspace model |
| Evidence to next action | Support outcome cohorts lead to learner selection, groups, intervention/reassessment and Scheme planning | Workspace UI and existing canonical action routes |
| Privacy and revocation | Active teacher account, live school membership, class/subject authority at database boundary | Integrated SQL account, subject and tenant denial tests |

## Repairs discovered during consolidation
1. Latest-assessment smart lists filtered older failing scores before choosing the
   latest record. The repaired function chooses latest released evidence first.
2. Daily attendance summaries mixed in lesson-occurrence registers. Daily
   projections and smart attendance rules now use daily registers only.
3. Targeted homework could flag unrelated learners, and draft submissions could
   hide missing work. Eligibility uses saved target-group membership and actual
   submitted/received/marked work; historical assignment membership is retained.
4. Private Workbook groups lacked subject scope for subject teachers. Group
   creation inherits an assigned subject when class-wide authority is absent.
5. Roster request IDs could accept changed input and admission checks could race.
   Existing provisioning receipts now bind a request to its payload, with
   school-level admission serialisation.
6. Scoreboard creation and reset used multi-request client mutations. Both now
   use bounded, authorised atomic PostgreSQL functions and verified return values.

## Limits and operational gates
- Natural-language queries are deterministic and explicitly bounded. Unsupported
  questions fall back to name search with an explanation, without invented answers.
- Classroom scores never become academic marks or mastery. A random pick does not
  itself prove participation. Parent-contact notes do not send messages.
- Gender/DOB are optional corrections, never roster-entry prerequisites. Parent
  relationships continue through the existing canonical parent-link flow.
- Cross-school transfers and learner-identity merges are not inferred from names
  or admissions. The teacher move flow is deliberately within one authorised school.
- The implementation requires all included migrations. Repository merge, deployed
  application and production database parity must be verified separately.
- Runtime, schedulers, publishing and payments are not commissioned by this change.

## Release gates
Run typecheck, lint, production build, Class OS/Teacher Pilot/Assessment Pack
contracts, Workbook model/SQL/DOM and integrated workspace model/SQL/DOM tests.
Required GitHub checks must pass on the exact final head after reconciliation.
Merge only that head, then verify resulting main lineage. Fresh production
verification is required before claiming the features are live.
