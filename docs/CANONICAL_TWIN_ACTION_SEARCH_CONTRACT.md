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
- select only an unlocked same-school exam;
- show the exact learner, class, subject, exam and mark before saving;
- require explicit confirmation;
- at execution time call the canonical Class Workbook path (`loadWorkbook` + `saveExamMarks`) so assignment, enrolment, exam lock, RLS and save read-back are checked again;
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
