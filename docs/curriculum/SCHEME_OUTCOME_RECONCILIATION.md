# Scheme → curriculum outcome reconciliation (12 November 2026)

## Existing authority and scope

The canonical records are `curriculum`, `curriculum_learning_outcomes`,
`scheme_of_work`, and `scheme_lesson_outcomes`. A scheme is not a second
curriculum. The curriculum topic/strand link is not enough to claim a specific
outcome has been linked or verified.

The live preflight before this change counted **149** scheme rows, **10** with
explicit outcome identities, and **139** without direct or junction outcome IDs.
Among those 139, **123 planned** rows came from the existing curriculum
scheme generator. All 10 direct links pointed to real outcomes with matching
sub-strands, but were `creator_claimed` authoring outcomes rather than
formal source-verification evidence. Only **32** of the **2,544** global
curriculum outcomes had status `verified` during this inspection.
Do not treat a large number of stored titles as proof of certified coverage.

## Automatic path (no HQ dependency)

1. The existing canonical Scheme generator persists planned lessons.
   The new **BEFORE** hook attaches a primary learning outcome only when the
   *same curriculum UUID + sub-strand UUID* uniquely identifies **one**
   source-verified outcome with an actual verification timestamp and locator.
   A lesson title, a topic-name resemblance, and an outcome count are never
   verification evidence.
2. The existing mapped Scheme writer continues accepting explicitly selected
   outcome IDs, including multiple outcomes per Scheme item. The new junction
   validation rejects mismatched sub-strands, mismatched non-null curriculum
   identities, inactive and nonexistent IDs.
3. If an authorised teacher saves exactly one explicit junction link for an
   otherwise unlinked **planned** Scheme, the primary outcome ID is filled
   automatically. The one-time repair also backfills only this provable case,
   with no changes to historical `teaching` or `done` rows.
4. Before a Scheme is **started** (`planned` → `teaching`) or marked directly
   **done**, the existing Scheme must have an outcome ID or saved junction.
   In-progress legacy records can finish without losing historical evidence.
   Planned drafts may remain without an outcome, but they must not be treated
   as teaching-ready or certified.
5. The read-only `scheme_outcome_reconciliation_status` view presents each
   currently accessible Scheme's live state. It uses **security invoker RLS**,
   reuses existing tables, and cannot grant approval or source verification.
   `OUTCOME_MISSING` and `LINKED_SOURCE_VERIFICATION_PENDING` are different.

## What this does *not* automate

The 139 missing historical links cannot be populated responsibly from topic
titles. The read-only preflight found **zero** single-source-verified matches
by exact curriculum ID + sub-strand, and **zero** historical missing-scheme
rows with pinned lesson-plan outcome IDs. Reconciliation for them requires
a source-backed canonical outcome and an explicit selection, not a guessed UUID.

This migration neither copies KICD text nor promotes creator-claimed outcomes,
adds a second approval authority, creates a new question bank, destroys teacher
data, publishes content or activates HQ/schedulers. The 139 baseline is a
**review backlog**, not automatically certified content.

## Verification / deployment

- Run `node --test scripts/test-scheme-lineage-automation.mjs`.
- Use the existing CI: `npm run test:curriculum-identity`, TypeScript,
  lint, build, database checks, governed merge and schema review.
- Apply the matching migration through the approved migration mechanism,
  not a browser-side client with bypass credentials.
- With authorised read-only database access:
  `select reconciliation_state,count(*) from public.scheme_outcome_reconciliation_status group by reconciliation_state;`
  Check that existing counts are preserved and that automatic repairs are
  only from explicitly selected single junction records.
- Exercise an authenticated teacher: create an unlinked planned draft;
  attempt to start it (must fail); choose a valid outcome; start again (may
  proceed); attempt to attach an outcome from another sub-strand (must fail).
  Confirm source-verification-pending outcomes are not presented as certified.
- Verify saved/archived plans, class/subject boundaries and completed
  occurrence history are unchanged. The database migration is additive;
  revert triggers/view if necessary, without rewriting historical rows.

## Follow-up

Reconcile by subject/grade as the current curriculum authorities are verified.
The view automatically reflects new links; when an exact unique verified source
is available, new generated Scheme records inherit it. **Existing unlinked
rows are not silently rewritten when an unrelated source is later verified.**


## Reusable curriculum → teacher Scheme acceptance (all next subjects, 22 November 2026)

Apply these gates to **every grade/subject** that is connected to the existing
Curriculum Map and Scheme of Work. This is an extension of the same canonical
curriculum/teacher/scheme authority, not another publisher, map, approval service,
or KICD source. Never equate deployed code with a working signed-in journey.

1. **Source and identity:** record the official KICD document edition and
   exact source locations; identify the existing `subjects` global UUID,
   school-subject UUID, grade, strand/sub-strand identities, and original
   outcome IDs. Reconcile counts, draft statuses and alternative units.
   Do not label paraphrases or owner-approved data as independently certified.
2. **Curriculum Map:** for an assigned teacher/class, confirm the real
   Curriculum Map route opens, shows the correct grade and subject, and
   permits browsing **all** matching sub-strands and their ACTIVE outcomes,
   not draft/other-subject data. Unassigned subjects must not be substituted.
3. **Scheme selection:** from that map, open the existing Scheme of Work
   with class, school subject, term and chosen sub-strand preserved. Choose
   an instructional week and one or more matching outcomes. Opening a map
   alone must not create a Scheme lesson.
4. **Authenticated save:** using a real authorized teacher session (not
   service-role, SQL session impersonation or a fabricated token), save
   **one** test lesson through the real UI. Reopen/refresh the Scheme,
   confirm the lesson appears in the correct class, subject, term and week,
   and inspect `scheme_of_work` plus `scheme_lesson_outcomes` read-only
   to confirm saved outcome IDs, source lineage and teacher ownership.
   Record the exact environment, teacher role, subject/grade, deployment
   commit, timestamp and evidence URL/screenshot. Leave created content
   intact or delete only through a legitimate, authorized teacher UI action.
5. **Negative/security cases:** unassigned teacher, another school/class,
   mismatched sub-strand/outcome, draft/inactive outcome, invalid week,
   missing term, expired/anonymous session, repeated submit and zero
   outcomes must fail without unrelated writes. Confirm existing RLS,
   teacher assignments and server-side RPC validation are enforced.
6. **Teacher continuity:** verify the saved Scheme lesson can be selected
   by the existing lesson-preparation path; the correct outcome identities
   survive the navigation. No substitute `curriculum` record, duplicate
   textbook or publication/HQ dependency is introduced.
7. **Review and release:** run the repeatable curriculum/scheme contract tests,
   production build, migration security/clean-rebuild checks and exact-head CI.
   Merge via governed PR, verify `main`, production deployment READY,
   migration installed, read-only data counts and the **real signed-in
   teacher end-to-end journey** on the deployed release.
8. **Evidence decision:** mark each of source, UI read, save, negative cases,
   teaching handoff and live deploy separately PASS/FAIL/BLOCKED.
   If teacher authentication/session or browser verification is unavailable,
   record `BLOCKED_ACCESS — authenticated teacher acceptance not executed`.
   Code/DB/CI PASS is **not** a substitute; do not claim full teacher
   acceptance or KICD certification.

**Grade 4 CRE / Creative Arts baseline:** PR #1961 merged as
`864d41545a287fe4e9ee47ec9b2ec46517a763f8`; production Vercel
deployment READY; read policy and Scheme RPC installed. Read-only checks
found CRE 35 sub-strands/129 active outcomes and Creative Arts 13
sub-strands/64 active outcomes (four additional drafts excluded);
there is at least one assigned teacher for each school subject.
**Authenticated teacher UI open/save/reopen and lesson handoff have not been
executed or certified.** Keep this gate pending for both subjects.

**Regressions:** `node --test scripts/test-grade4-cre-ca-teacher-visibility.mjs`
and `node scripts/test-curriculum-scheme-routing.mjs` run in the existing
Engineering Integration Gate. These source-contract checks protect wiring
but do not replace the signed-in acceptance in item 4.
