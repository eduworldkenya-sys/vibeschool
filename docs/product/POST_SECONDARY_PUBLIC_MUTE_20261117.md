# School-only public rollout — owner-directed post-secondary mute

## Decision and scope

Effective from 17 November 2026, only pre-primary through secondary school (including Grade 10–12 and Form 4) is offered publicly. College/TVET, university, CPA, CS and legacy academy courses are dormant, not deleted. School-level career guidance remains available. This is a release-scope restriction, not a change to levels, payment, learner identity, school records or content ownership.

- Frontend/server: `POST_SECONDARY_PUBLIC_ENABLED` in `lib/learner/learning-levels.ts` filters discovery and registration. Server registration resolves active choices; course layouts deny direct routes, old links redirect, and existing post-school accounts receive a neutral unavailable screen while retaining identity and study records. QA choices follow the public scope. Known paused books are also hidden from locally stored library listings; no offline book data is deleted.
- Database: `public.post_secondary_public_enabled()` returns false. Restrictive RLS policies intersect existing permissions on academy and post-school publication tables; privileged reader, save/progress, catalogue, quiz and storefront RPCs include the same gate. Existing private pathway reads are still owner-scoped so the web route can identify a paused learner without changing their grade. Database policy does not broaden any original access grant.
- Keep future post-secondary publications classified using explicit CPA/KASNEB/professional/college/TVET/university/post-secondary tags or post-secondary grade metadata. Unknown or general school-age reading is not automatically classified as post-secondary. The legacy academy tables are not the KICD school library.
- HQ governed admin RPCs and internal storage remain intact. No content/status/release/history/identity rows were deleted or rewritten. Data access on already-disconnected devices cannot be forcibly revoked until they receive an updated application; the public app and updated offline library hide the known publications.

## Live database validation

Migration `20261117042515_mute_post_secondary_public_scope.sql` is the exact version recorded in the production migration ledger by the governed migration tool. The SQL was tested in a transaction with anonymous/authenticated role assertions and rolled back; it was then applied under explicit owner instruction to suppress the public feature. Post-apply live verification found 0 visible courses/modules/topics/CPA books/CPA chapters from both ordinary database roles, and 15 visible school textbooks on both. The privileged inventory remained: 9 courses, 22 CPA paper modules, 11 published CPA topics, 2 published CPA originals, 1 existing post-secondary pathway.

## Clean migration replay reconciliation

The production migration ledger retains the original applied statements. The repository version adds replay-only prerequisites for `course_enrollments` and `vibe_saved_items` (tables already present in production but absent from earlier clean migration replay). Columns, constraints, indexes, grants and permissive owner policies were checked against the live PostgreSQL catalog. The restrictive policy still applies on both fresh and production databases. The school-path predicate assertion is independent of seed data for clean replay; live positive textbook counts are verified separately above. No further production mutation was performed to reconcile repository replay.

## Unmuting

The release must be explicitly approved. Do not drop security policies or change historical content status. In a reviewed forward migration replace only `public.post_secondary_public_enabled()` to return true. Re-enable the application flag in the same reviewed release and test the full account, course, assessment, catalogue, publication, existing learner and QA journeys. Reconcile switch state and validate both database and production frontend; neither gate should be considered sufficient on its own. For the next public-only release the two gates must continue to deny by default.

## Evidence boundary

Backend production restriction was applied and verified. Frontend implementation requires exact-head CI, reviewed merge and runtime deployment verification before a complete public mute can be claimed. This connector-only host could not run the local Cyborg execution scripts or local build; no independent assurance is implied.
