# Canonical Twin action, search and learning contract

Status: implementation contract for the October 3, 2026 Canonical Twin closure.

## Product behavior

Twin remains deterministic and relationship-authorized. It is not an LLM wrapper.

The Teacher Twin now has four connected modes:

1. **Answer** — reads the server-authoritative Teacher Twin brain and current school workflow state.
2. **Search / navigation** — resolves common Teacher OS destinations from natural language and returns an in-app action.
3. **Prediction** — reports likely near-term workflow pressure only from recorded signals such as missing attendance, marking backlog, overdue scheme items and reflection gaps. Predictions are explicitly labeled as forecasts, never facts.
4. **Confirmed action** — parses a bounded natural-language write request, resolves its exact school/class/learner/subject/exam authority, explains the proposed mutation, requires the teacher to confirm, then revalidates authority and performs a canonical save with read-back.

## First commissioned write skill: exam marks

Example:

`add 40 marks to Sifuna in Maths CAT`

Twin must:

- use `teacher_get_operating_context` for active-school and teacher authority;
- match only current enrolled learners in classes where the teacher is assigned to the matched subject;
- fail closed on ambiguous learner, subject or exam matches;
- reject marks outside 0–100;
- resolve a unique same-school exam and reject locked exams;
- show the exact learner, class, subject, exam and mark before saving;
- require explicit confirmation;
- at execution time call the shared `teacher_save_exam_result` authority used by Results and Workbook; recheck active account, school, assignment, current enrolment, ownership, exam lock, expected timestamp and complete save read-back;
- never let generated text or browser IDs act as authority.

## Continuous learning meaning

“Twin learns” means evidence-backed memory and workflow adaptation, not hidden model training on private school data. Individual Twin memory remains provenance-bound. Cross-user product improvement must come from aggregate, governed product rules/metrics rather than copying one user’s private records into another user’s Twin.

## Safety boundary

Consequential writes are not performed merely because a sentence looks like a command. Each commissioned write skill has a deterministic parser, authority resolver, ambiguity policy, preview, confirmation step, execution revalidation and outcome evidence.

Unsupported write requests remain unsupported until a specific governed action skill is added.

## Definition of done

- AI can be disabled and all commissioned Twin behavior still works.
- Search never grants authority.
- Predictions disclose that they are forecasts from recorded evidence.
- Ambiguous identities/scopes fail closed.
- Writes require confirmation and authoritative revalidation.
- Existing Teacher Twin authority, multi-school behavior and role switching stay intact.
- `npm run test:twin` is part of the repository validation chain.

## Personal workflow implementation

Teacher, admin, parent, student and HQ drawers share deterministic navigation, private scoped memory controls and evidence-based workflow suggestions. Existing student tutoring and role-specific authority answers remain available. Teacher record search paginates and fails explicitly at its bounded ceiling; it never silently truncates a target search. Query-string, route, session, cancel and subsequent-command changes invalidate an earlier confirmation. A proposal expires after five minutes.

Results, Workbook and Twin use one result authority. Workbook batches are atomic and reject duplicate targets. Same-value retries are idempotent; conflicting stale saves fail. Existing ownership cannot be reassigned by a save. Absence remains distinct from a zero score.

Successful domain mutations can record coarse workflow observations while the drawer is closed. Observations contain no learner names, marks or arbitrary content, expire after 90 days, and can be paused or forgotten. Collective hints require explicit opt-in, a completed-week window and at least 50 participating users. Unsupported mutations stay unsupported.

## Release evidence boundary

The consolidated closure supersedes the overlapping action-layer draft in PR #723. Local build, actual SQL/RLS tests, service tests and DOM confirmation tests are release gates. Independent review and CI must bind to the final candidate commit. A signed-in production journey is a separate required certification gate; build success or a login redirect does not satisfy it.
