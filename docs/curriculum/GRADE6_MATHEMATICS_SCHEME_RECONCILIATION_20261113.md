# Grade 6 Mathematics — curriculum and Scheme reconciliation (13 November 2026)

## Scope and authorities

- Governing educational workflow: `docs/curriculum/CONTENT_GENERATION.md`.
- Restricted transcription/rights contract: `docs/curriculum/COPY_KICD_CURRICULUM.md`. Its stated permission scope is not independently verified.
- Official KICD Grade Six designs catalogue (currently indexed): https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/ (choose Mathematics).
- Historical KICD Grade 6 Mathematics 2024 PDF locator (preserved in legacy source provenance): https://kicd.ac.ke/wp-content/uploads/2024/10/Grade-6-Mathematics-Revised.pdf . Direct fetch returned HTTP 404 on 13 November 2026; indexed older copies are not proof that the direct link still works.
- Grade 6 mathematics official KICD 2024 source structural summary, printed p. xii: four strands, sixteen sub-strands, 150 suggested lessons, five mathematics periods per week. The 150-lesson allocation is a suggestion and does not override a school's actual term/calendar rules.

## Live canonical read-only inspection

Queried production Supabase project `yauqsxggtuxuykcbrtzf` on 13 November 2026, using the existing canonical reader bindings / outcome and Scheme tables:

| Check | Live result |
| --- | ---: |
| Active `grade6_mathematics_reader_bindings` | 16 |
| Matched `cbc_strands` identities | 16 |
| Active `curriculum_learning_outcomes` | 97 |
| Existing outcomes with `verified_at` set | 0 |
| `creator_claimed` source outcomes | 97 |
| Suggested lessons in `curriculum_unit_guidance` | 150 |
| Saved `scheme_of_work` rows attached to these 16 sub-strands | 0 |
| Saved direct Scheme outcome links | 0 |
| Saved Scheme junction links | 0 |

This **is not** a complete KICD source transcription, proof of literal word-for-word match, or full source-to-outcome certification. No one should promote `creator_claimed` records to `verified` based solely on a source URL, a copied title, or these counts.

## Canonical existing connections (do not rebuild)

`grade6_mathematics_reader_bindings.source_ref` → `cbc_strands.id` → `curriculum_learning_outcomes.sub_strand_id` → teacher-authorized `commit_mapped_scheme_lesson` → `scheme_of_work.curriculum_outcome_id` plus `scheme_lesson_outcomes`.

The teacher curriculum reader and annual Scheme preview are already implemented and merged in PR #1363. They compute 150 lessons against the *actual selected school calendar* and require a teacher-authorized save; a preview is not a persisted Scheme. A school timetable is not a prerequisite for curriculum browsing. No artificial Scheme lessons or teacher identities were created during this audit.

## This patch

The teacher-facing original-source link used an archived PDF URL that currently responds 404. The teacher-facing curriculum reader now opens the current official KICD Grade Six catalogue; teachers select **Mathematics** there. The legacy PDF locator remains unchanged for historical provenance and source comparison. The Grade 6 regression test now prevents the teacher reader from silently reverting to the inaccessible link. Curriculum outcomes, teacher-owned Schemes, DB tables, RPC authorization and period allocation are unchanged.

## Still required for full subject completion

1. Confirm legal authority covering private full-text storage/transcription and handling by service providers before a verbatim import; otherwise retain `RIGHTS_SCOPE_UNVERIFIED`.
2. Acquire the current, accessible publisher artifact, inspect **all** pages and appendices and establish an atomic source inventory with page locators; separately reconcile the 97 authored outcomes and all missing official requirements without guessing.
3. Retain canonical IDs. Add verified source-to-outcome evidence and protected source storage only through the existing authorized curriculum-authority workflow; do not publish KICD literal text to teacher/learner clients or public GitHub.
4. Verify a genuine authenticated Grade 6 teacher selecting a sub-strand and outcomes, saving a Scheme item, reopening that exact outcome link, and viewing its related teaching content. Only then claim a live teacher journey.
5. Do not equate GitHub merge, passing static tests or a catalog link with content publication or certified curriculum alignment.

**Recorded states:** STRUCTURE_MATCHED; SCHEME_CODE_CONNECTED; SOURCE_LITERAL_COPY_NOT_PERFORMED; OUTCOME_SOURCE_VERIFICATION_PENDING; TEACHER_SAVED_SCHEME_ABSENT; RIGHTS_SCOPE_UNVERIFIED; AUTHENTICATED_TEACHER_REPLAY_NOT_CHECKED.
