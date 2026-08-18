# VibeTwin Date + Released Results — Handover

Date: 2026-08-18 EAT
Branch: `agent/twin-date-results-20260818`
Scope: only the two requested deterministic conversational skills.

## Goal

Close two concrete Student Twin gaps without generative AI:

1. General date/day questions such as `What day is today?`, `What date is today?`, `When is today?`.
2. Learner result-release questions such as `Did my teacher send my results?`, `Are my results out?`, `Have my results been released?`.

## Implementation

### Date skill

`student_twin_date_results_route(text)` resolves the current day/date using PostgreSQL time explicitly converted to `Africa/Nairobi` and returns a deterministic response such as `Today is Tuesday, 18 August 2026.`

It does not infer the date from timetable data and does not use browser-local time, an LLM, or an external service.

### Results-release skill

The same deterministic skill router calls the existing `exq_list_my_results()` authority RPC. That existing RPC returns only attempts belonging to the authenticated learner where both assessment status and result status are `released`.

Therefore Twin answers:

- if at least one released result exists: `Yes. Your latest released result is <assessment> at <percentage>%.`
- if none are visible: `I do not see any results released to you yet.`

The negative answer deliberately does **not** claim the teacher has not marked, reviewed or prepared a result. It only states the authoritative learner-visible fact.

### Client routing

`lib/student/twinCore.ts` checks the small date/results deterministic skill router before the wider Student Twin router. Unmatched questions continue into the existing router unchanged.

If the forward migration is missing in an environment, the helper failure does not outage the existing Twin; the client falls through to the existing router.

## Security and 98/2 constitution

- authenticated identity required;
- anonymous/public execute revoked;
- existing learner-authorized results RPC reused;
- no raw cross-learner assessment query added;
- no OpenAI, Claude, Gemini, Anthropic or other generative runtime dependency;
- `requires_ai = false` for both skills;
- no authoritative school state is mutated.

## Regression contract

`scripts/test-student-twin-date-results-contract.mjs` certifies:

- Nairobi-local date authority;
- explicit `current_date` intent;
- explicit `results_release_status` intent;
- reuse of `exq_list_my_results()`;
- bounded negative wording;
- authenticated-only execution;
- zero generative dependency;
- deterministic helper before legacy Student Twin routing;
- safe fallback to the existing router.

The contract is wired into `.github/workflows/deterministic-twin-contract.yml` for branch and PR validation.

## Production promotion evidence

The certified function SQL was promoted to production Supabase project `yauqsxggtuxuykcbrtzf` after the first exact-head gate set was green.

Production recorded migration:

- `20260818084507_student_twin_date_results_skills`

Repository migration filename is aligned to that exact ledger version:

- `supabase/migrations/20260818084507_student_twin_date_results_skills.sql`

Post-promotion verification confirmed:

- `student_twin_date_results_route(p_input text)` exists;
- `authenticated` has EXECUTE;
- `anon` does not have EXECUTE.

No Vercel deployment was triggered from the feature branch. Because ledger-parity file renaming and this handover update changed the branch head after production promotion without changing function SQL, the final branch head must be re-certified before merge.
