# CPA CA11 production ledger reconciliation — 15 November 2026

The reviewed CA11 authoring, private college catalogue/quiz gate and first-unit release were merged to main (content PR #1751, release PR #1753) and **applied to production using the governed Supabase migration tool**, which generated a new version for each application. The checked-in numeric filename must represent the *actual* server migration ledger version, rather than an earlier locally proposed version.

| Production migration name | Actual applied version | Old uncommissioned filename version |
|---|---|---|
| `stage_cpa_ca11_intro_foundation` | `20261115124103` | `20261115115000` |
| `cpa_private_paper_catalogue_and_quiz_gate` | `20261115124125` | `20261115121200` |
| `release_cpa_ca11_intro_unit` | `20261115124726` | `20261115122500` |

The SQL files have been moved *without changing their bytes*, tests/workflow path references have been reconciled and the former uncommissioned paths removed. **Do not reapply these SQL migrations or hand-edit `supabase_migrations.schema_migrations`.**

## Deployment and security evidence

- GitHub PR #1753 exact-head workflows: 27/27 successful; merged commit `f392c76941b92ad40ffe049855848144c0f53023`.
- Production Vercel `vibeschool.co.ke` reached `READY` on the exact `f392c769` main before final publication.
- Supabase readback: `kasneb-cpa` live, 22 paper modules, 3 published CA11 topics, 12 CA11 quiz questions; `kasneb-cs` remains `coming_soon`.
- Existing course enrolments, course learner profiles and course progress were all zero before/after production publication. No user enrolment or account data was silently changed.
- Authenticated CPA owner-scoped catalogue returned all 22 papers and a live CA11 availability flag; an unqualified account ID was denied access.
- Practice service returned 4 questions for a published first lesson, withheld explanations/answer metadata before answer submission, marked a known correct option and rejected a forged answer ID.
- Anonymous users have no EXECUTE privilege on private catalogue or quiz functions; browser roles have no SELECT privilege on raw `quiz_questions`.
- Signed-in physical-device learner flow remains a separate operational smoke test; do not claim manual end-to-end login verification from SQL alone.

## Release boundary

The first released unit is **only** the introduction to accounting (KASNEB CA11 syllabus subsections 1.1–1.5); this is not a completed full paper or an official KASNEB qualification. The source version is the reviewed June 2024 KASNEB CPA syllabus, checked with April 2026 course identity, and original VibeSchool explanations were authored separately. Advanced paper-code drift remains unresolved for learner registration guidance.

## Post-merge verification

After the ledger-only PR merges, confirm both `main` filenames and remote migration ledger contain exactly these versions, run the previously required content, professional learner and security contracts, and confirm the production content counts remain unchanged. This release changes no privileges, content rows, publication status or student profiles after the initial reviewed publication.
