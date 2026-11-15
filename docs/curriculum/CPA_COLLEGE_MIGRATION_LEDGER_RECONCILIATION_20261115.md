# CPA & CS migration-version reconciliation — 15 November 2026

This change aligns migration source filenames with the versions **actually written** by the Supabase migration API when the already-merged CPA catalogue and College learner-path migrations were applied to production.

| Schema migration | Production ledger version | Former uncommissioned repository file version |
| --- | --- | --- |
| seed_kasneb_cpa_cs_learner_catalog | `20261115111910` | `20261115134500` |
| canonical_post_secondary_learner_path | `20261115112112` | `20261115114000` |

These are **byte-for-byte identical SQL bodies** relocated to the deployed ledger versions; no migration content, app behavior, auth, grants, age policy, course publication status or client rows changed. Original files are removed to prevent double execution and future schema drift.

This matches the approach adopted in merged PR #1738 for school publishing. The Supabase GitHub integration reported `Remote migration versions not found in local migrations directory` for merge #1746. Restoring the deployed ledger versions in the local migration directory is a source-control reconciliation, **not** a mutation of `supabase_migrations.schema_migrations` and does not delete database objects or repair production migration rows.

Verification: full clean database reconstruction, Supabase migration contract, KASNEB 22 CPA/18 CS module tests, College owner-RLS tests, app TypeScript/build, exact-head CI and post-merge Supabase preview check. Both qualifications remain unpublished until content QA passes.
