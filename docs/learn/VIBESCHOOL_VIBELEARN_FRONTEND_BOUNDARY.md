# VibeSchool Learn ↔ VibeLearn frontend boundary

## Decision

VibeSchool Learn is the **discovery and navigation layer**. VibeLearn is the **learner workstation and study engine**. They share canonical curriculum, publication, account and learning records, not duplicated content stores or engines. Harmonising the frontend must not silently change VibeLearn's reader, progress, practice, revision, identity or authorization behaviour.

## Routes and ownership

| Entry | Responsibility | Constraint |
| --- | --- | --- |
| `/learn` | Public grade → subject → released lessons and textbooks | Public catalogue is discovery, never proof of reader entitlement or curricular completion |
| `/learn/grade-4/mathematics/time`, `/learn/grade-1/creative-activities` | Existing governed subject readers | Display approved/certified learner content only |
| `/student/vibelearn` | Learner's canonical workstation | No replacement or separate independent-learner engine |
| `/student/vibelearn/reading` | Authenticated school/independent learner subject discovery | Same student identity, grade and subject context, no duplicate reading state |
| `/read/textbook/[publicationId]` | Canonical entitled textbook reader | Its own server authority decides readable chapter and records progress |
| VibeLearn Topic Practice, Exams, Revision and Mistakes routes | Existing assessment/recovery engines | Navigational handoffs must not invent evidence or bypass attempt/release rules |

## Data authority

1. Grade and subject: use effective-dated `grade_subject_authority` when permitted. A public fallback subject catalogue is a **discovery label**, never a certified curriculum record.
2. Curriculum and topic/outcome mappings: use existing canonical curriculum records. Do not infer a strand, sub-strand, outcome or completion from the display label.
3. Public textbooks: list only `vibe_publications` with published status and `vibetextbook` format. Actual chapter access remains governed by the existing reader authority.
4. Published original lesson packages and visuals: respect the existing certified-only reader and visual library contracts.
5. Learner progress, practice, mastery, assignments and tuition/school links: remain under their existing VibeLearn and student authorities. Never write to them from public discovery.

## Implemented handoff (PR #1508)

Only the **public-mode** school library adds `Continue in VibeLearn`. Its URL is built using the selected grade and selected subject, and opens the existing `/student/vibelearn/reading` route. Student-mode navbar content remains `Learning desk` and `My tasks`.

## Regression and promotion gates

- The PR diff must contain no `app/student/vibelearn/**`, `app/read/**`, `lib/student/**`, Supabase SQL, middleware or exam-engine changes.
- Run `scripts/test-unified-school-learn.mjs`, existing `test:vibelearn`, Reader Excellence, TypeScript and build checks on the exact head.
- Browser verify public grade/subject → learner handoff, signed-in school learner, signed-in independent learner, Grade 4 Mathematics Time, Grade 1 Creative Activities, protected textbook reader and a phone-sized viewport.
- Check a non-published or locked textbook never becomes readable because it appears in a discovery list.
- Do not merge solely on static test results; complete the relevant CI and signed-in smoke tests.

## Remaining reconciliation

Canonical **strand → sub-strand → outcome → lesson** browsing is not yet proven by the shared grade/subject library. Implement that as a read-only mapping using verified curriculum-to-publication identities, then return directly to the existing VibeLearn reader and practice routes. Do not fill gaps with invented topic data, hardcoded completion indicators or a parallel question bank.
