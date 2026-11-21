# VibeSchool original content — independent automated review without manual HQ or KICD sign-off

**Owner decision:** Normal VibeSchool-original content must not require a human to visit HQ, click an approval button, or request a KICD officer's endorsement. Do **not** confuse the internal `source_status='approved'` database state with external KICD textbook approval.

## Workflow

1. Resolve the exact official KICD curriculum document and its edition/page locators. An independently fetched and hashed source must have genuine retrieval provenance. The reference is not permission to reproduce or redistribute the KICD PDF, and VibeSchool does not claim external KICD endorsement.
2. Keep the original VibeSchool source-to-outcome crosswalk, version payload SHA, rights, assessment lineage, protected teacher notes and marking scheme privacy checks.
3. **One-time authorization**, separate from an HQ approval screen: a genuine authenticated platform-owner session commissions an existing independent reviewer **real `auth.users` identity**, for one draft publication, listed stages, a subject-specific qualification, rubric/version and an expiry of at most 30 days. `ce_commission_machine_content_reviewer` does not mint that identity. It cannot commission the publication author or the commissioner.
4. A separately authorized backend independent critic produces version/hash-bound evidence and records it with `ce_record_machine_content_review` (only `service_role` can invoke it). A `PASS` receipt requires score >=85, zero hard blockers, curriculum reference, subject correctness, assessment coherence, rights and provenance, an independence statement and an execution identifier. This SQL gate cannot itself assess whether mathematical claims are correct; the real qualified critic must produce a genuine review. Do not forge results, reviews or credentials.
5. An authenticated reviewer uses existing `hq_review_teacher_guide`, `hq_review_generated_assessment` and `hq_review_publication_release` RPCs. **No human HQ membership is required** for a commissioned machine reviewer with a fresh exact-artifact `PASS` receipt. Human reviewers remain a compatibility fallback; the three original quality/release gates still run.
6. An independently verified source may be registered through `curriculum_authority_register_source` only with an official `kicd.ac.ke` URL, document SHA and matching source-review receipt; this is internal source identity, **not** a KICD officer sign-off. Existing screenshot/PDF retrieval, registry artifact, sealed snapshot and canonical hierarchy checks remain required.
7. A commissioned machine resource certifier may use the existing `cla_certify_learning_resource_version` with an exact version SHA receipt; previous verified+rights cleared lifecycle and curriculum promotion trigger still apply. Neither source registration nor resource certification is automatically performed by installing this migration.
8. **Publishing:** existing `publish_publication` still checks the genuine authenticated author (Mumbi2 where applicable), the publication fingerprint, release checks, business policies and learner-facing index. This change never mints a publisher session or publishes any chapter.

## Status and boundaries

This is a **non-commissioning code change**: no machine reviewer account, commission, PASS receipt, KICD source record, release approval, certified version or published book is created by the migration. Before this route becomes operational, a qualified Grade 4 Mathematics critic/backend must be commissioned and independently produce real evidence. Existing Chemistry-only critic results are not sufficient.

All new machine authorization tables use RLS with no browser table access. Backend receipt ingestion is service-role only, reviewer sessions have real user IDs, submissions are scoped to a single exact publication, stale review receipts are rejected, reviewers can be revoked, and negative/reject decisions remain separately protected. An owner can commission or revoke through authorized functions without visiting HQ.

## Owner review points

- Code: `supabase/migrations/20261121191000_qualified_machine_content_review_no_human_hq.sql`
- Regression: `scripts/test-qualified-machine-content-review-no-human-hq.mjs`
- Existing content governance: `scripts/sql/g4_whole_numbers_release_preflight.sql`
- Existing Grade 4 Whole Numbers publication: GitHub issue #1814

**Do not remove the official source, correct answers, copyright, tenant RLS, authenticity, independent critic or exact publisher authorization gates merely to produce a green preflight.** Their evidence is what permits safe automated release.
