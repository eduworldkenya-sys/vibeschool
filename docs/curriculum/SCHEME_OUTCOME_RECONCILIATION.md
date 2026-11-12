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
