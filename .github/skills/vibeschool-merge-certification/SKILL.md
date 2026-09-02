---
name: vibeschool-merge-certification
description: Exact-head verification, reconciliation, merge and post-merge protocol for VibeSchool pull requests.
---
# VibeSchool Merge Certification

A PR is not merge-ready because code looks correct or earlier CI was green.

Required sequence:
1. Resolve current PR head SHA and current main SHA.
2. Inspect changed files, migration/authority blast radius, review threads and overlapping active work.
3. Confirm candidate is reconciled with current main; if not, reconcile without discarding newer canonical behavior.
4. Run/inspect all risk-relevant checks on the exact candidate head: targeted tests, typecheck/lint/build, contracts, migration/security/authorization and repository-required CI as applicable.
5. Perform adversarial review and repair material findings.
6. Re-check head/base freshness after checks complete.
7. Record certification against the exact SHA only.
8. Merge only when explicitly authorized, using expected-head protection where available and without bypassing required protection.
9. Verify the merge result on main.
10. When production is in scope, verify deployed SHA/version plus affected production journey/contracts. Merge/deploy success alone is not production verification.

Status vocabulary is strict: IMPLEMENTED != VERIFIED != CERTIFIED != MERGED != PRODUCTION_VERIFIED.
