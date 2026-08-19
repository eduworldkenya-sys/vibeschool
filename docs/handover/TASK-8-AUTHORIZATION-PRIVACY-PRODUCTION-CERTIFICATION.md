# TASK 8 — AUTHORIZATION, PRIVACY, RLS, GRANTS & CROSS-ROLE SECURITY PRODUCTION CERTIFICATION

## Status

**RECONCILE REQUIRED**

Task 8 is an open draft foundation PR and MUST NOT be promoted ahead of Task 3. The certified promotion chain remains:

`T2 → T1 → T3 → T8 → T4 → T5 → T6 → T7`

When Task 3 merges, rebase/reconcile this branch against exact-current `main`, invalidate affected security evidence, then rerun the complete authorization certification before promotion.

## Repository

- Repository: `eduworldkenya-sys/vibeschool`
- PR: `#288 — Task 8: certify production authorization and privacy boundaries`
- Branch: `security/task8-authorization-privacy-20260819`
- Base: `main`
- Exact candidate SHA: record only after Task 3 reconciliation and final security changes stop
- Production Supabase project: recorded in the operator environment; do not copy credentials or child data into this handover

## Security law

Authentication identifies a caller. Current canonical identity, current relationships, exact tenant/resource correlation, lifecycle state, and server/database enforcement authorize the operation.

Never authorize a consequential action from a caller-supplied `user_id`, `student_id`, `school_id`, `parent_id`, `teacher_id`, URL, local storage value, editable metadata, frontend role, or cached membership without re-establishing current authority at the consequential boundary.

## Production forensics — current read-only evidence

Current production inventory observed during Task 8 execution:

- 553 public base tables
- 553/553 public base tables have RLS enabled
- 820 public `SECURITY DEFINER` functions
- 0 current public `SECURITY DEFINER` functions missing a pinned `search_path`
- 0 `SECURITY DEFINER` functions executable through PostgreSQL `PUBLIC`
- 7 public `SECURITY DEFINER` functions executable by `anon`
- 483 public `SECURITY DEFINER` functions executable by `authenticated`
- `anon`, `authenticated`, and `service_role` have `USAGE` but not `CREATE` on schema `public`
- 21 public views, 0 public materialized views; all 21 current views are `security_invoker=true`
- 7 public views are anon-selectable and 18 are authenticated-selectable
- 8 Storage buckets currently exist; `homework-photos`, `hq-company-library`, and `curriculum-authority-artifacts` are private; catalogue/content/avatar buckets are intentionally public pending per-domain classification
- production default ACLs currently re-grant structural table privileges and broad function/sequence privileges to future objects; repository repair is staged but MUST NOT be considered production-fixed until promotion/postflight

These are structural facts only. They do not themselves prove row/resource authorization.

## Reproduced vulnerabilities / security defects

### Previously reproduced on the Task 8 branch

1. School Admin `pending_actions` create was not correlated to the inserted row's `school_id`.
2. Global `audit_logs` could be read by school Admin authority despite not being tenant-scoped.
3. Teacher competency evidence trusted authorship (`observed_by = auth.uid()`) without proving current Teacher→learner authority.
4. Marking/grade/homework authority could survive stale relationships through author/marker identity.
5. Private tables retained unnecessary anonymous grants.
6. Anonymous child share-link enumeration existed.
7. `reset-student-pin` could elevate to Auth Admin after a broad role check without target learner authorization.
8. Cron routes failed open when `CRON_SECRET` was absent and accepted query-string secrets.
9. Service-role lesson generation did not first prove a current Teacher assignment.

### Newly reproduced during this reconciliation pass

10. **Future-object default ACL privilege reintroduction (P1):** current production default privileges can reintroduce `TRUNCATE`, `TRIGGER`, `REFERENCES`, `MAINTAIN`, sequence mutation, and broad function execution on new public objects even after existing-object cleanup.
11. **Legacy permissive Storage policy collision (high severity):** `homework_photos_school_staff_select` coexists in production with the hardened `homework_photos_staff_read_v2`. Because permissive policies combine with OR, the older same-school/staff policy can weaken the current Teacher→class→learner requirement.

## Repository repairs

### `20260819030000_task8_authorization_privacy_boundaries.sql`

- correlates `pending_actions` School Admin policy to row `school_id`
- restricts global audit/internal metadata to HQ owner
- moves Teacher evidence, grade, homework, and marking authority toward current canonical relationships
- removes anonymous child-share enumeration policy
- narrows Parent RPC execution
- introduces canonical homework-photo Storage staff read policy
- tightens grants on the hardened private surfaces

### `20260819031500_task8_private_surface_least_privilege.sql`

- removes broad anonymous authority from classified private surfaces while preserving deliberate public catalogue behavior

### `20260819033000_task8_authenticated_privilege_minimization.sql`

- removes unusual structural privileges from application roles on existing public relations
- tightens notification recipient/school relationship correlation

### `20260819034500_task8_twin_privileged_helper_boundary.sql`

- removes direct authenticated execution of privileged Twin helper operations while preserving intended elevated boundary access

### `20260819040000_task8_public_default_privilege_hardening.sql`

- hardens future public-object defaults for both `postgres` and `supabase_admin`
- removes structural client privileges from future tables
- removes sequence UPDATE from application roles
- removes default function EXECUTE from `PUBLIC`, `anon`, and `authenticated`
- defensively re-applies structural privilege cleanup to existing public tables/partitions

**Runtime proof still required:** confirm the migration executor can apply all `ALTER DEFAULT PRIVILEGES FOR ROLE ...` statements on clean reconstruction and existing-state upgrade, and verify legitimate newly-created RPCs retain explicit grants where intended.

### `20260819041500_task8_storage_permissive_policy_cleanup.sql`

- removes `homework_photos_school_staff_select`
- removes legacy homework-photo staff policy variants
- preserves the canonical `homework_photos_staff_read_v2` relationship-scoped path

## Permanent regression coverage

`scripts/test-task8-authorization-contract.mjs` currently guards source-level invariants for:

- tenant-correlated pending actions
- HQ-only global audit
- current Teacher→learner evidence/marking authority
- child share-link enumeration removal
- private anonymous privilege minimization
- notification school/recipient correlation
- Twin privileged helper execution boundaries
- target-authorized student PIN reset
- current guardian relationship checks in learner provisioning
- Teacher assignment checks before lesson-generation service elevation
- fail-closed bearer-only cron authorization
- future-object default-ACL hardening
- legacy homework Storage policy removal

Source assertions are regression evidence only. They are NOT substitutes for SQL impersonation/direct REST/RPC/Storage runtime attacks.

## Role matrix — certification model

| Caller | Student/private learner | Teacher-class academic | Parent-child | School tenant | Finance | Messages | Twin/Pathways | Global audit/HQ |
|---|---|---|---|---|---|---|---|---|
| anon | DENY except explicit catalogue | DENY | DENY | public directory only | DENY | DENY | public catalogue only | DENY |
| unresolved authenticated | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| Student A | SELF / lifecycle conditional | own learner operations | N/A | minimum necessary | own visible finance only | membership only | SELF / lifecycle conditional | DENY |
| Teacher A | assigned-current learners only | assigned-current class/subject | intended educational scope only | current membership only | DENY unless separately authorized | membership only | assigned educational scope only | DENY |
| Parent A | verified active linked child only | read-only intended child scope | linked child only | minimum necessary | linked-child intended finance | membership only | linked-child intended visibility only | DENY |
| School Admin A | School A intended learner/admin scope | School A | School A relationship admin | School A only | explicit finance authority only | School A intended | School A intended | DENY |
| HQ owner | explicit platform-owner scope | explicit owner scope | explicit owner/support scope | platform owner | explicit owner scope | explicit owner/support scope | explicit owner/support scope | ALLOW |
| service_role | never direct end-user capability | server/internal only after reauthorization | server/internal only | server/internal only | webhook/internal boundary | server/internal only | server/internal only | internal only |
| runtime worker | exact temporary authority envelope only | exact grant only | exact grant only | exact grant only | exact grant only | exact grant only | exact grant only | no implicit HQ |

Every `CONDITIONAL`/scoped cell must gain a positive and a negative runtime control before final certification.

## Attack corpus

Permanent runtime suite must include at minimum:

- Student A → Student B private read/write
- Teacher A → unrelated learner and unrelated class
- Teacher with revoked class/school relationship using an already-authenticated session
- Parent A → Parent B child by known UUID/admission/name
- revoked Parent relationship with same active session
- Admin A → School B read/create/update/delete
- ordinary authenticated → HQ/audit/security/workforce/control data
- arbitrary UUID substitution into privileged RPCs
- direct REST table operations bypassing UI
- direct privileged RPC invocation
- Storage path guessing/listing/cross-student access
- academic unreleased-result access
- role mutation/self-promotion
- missing/wrong/malformed cron authorization and query-string secret attempts
- user-triggered service-role route with unrelated target IDs
- authorization TOCTOU around relationship revocation

Every denial should be paired with a legitimate same-resource positive control where safe.

## Privilege model

### `anon`

Intent: public catalogue/search/discovery only plus explicitly designed public endpoints. No direct child/student/parent/assessment/homework/Twin/private finance/messages/audit/workforce writes or reads.

### `authenticated`

Intent: minimum SQL privileges necessary to reach RLS/RPC boundaries. Authentication by itself must never create school, learner, family, finance, HQ, or Teacher assignment authority.

### `service_role`

Intent: infrastructure/server operation. Because it bypasses RLS, every user-triggered elevated flow must prove current caller authority before elevation. Webhooks/cron/internal operations require their own non-session trust boundary.

### `PUBLIC`

Intent: no privileged function execution. Explicit catalogue capabilities should be granted narrowly to `anon`/`authenticated` as required rather than inherited accidentally.

## SECURITY DEFINER classification gate

Current production count is 820. Search-path pinning is already structurally green, but callable scope remains large:

- anon-executable: 7; current observed names are catalogue/reader/storefront/public school-search helpers and require explicit classification as public product APIs
- authenticated-executable: 483; each must be classified as self-owned, relationship-scoped, school-scoped, owner-only, service/internal, or intentionally public-authenticated

High-risk families must receive direct invocation tests, especially Admin/provisioning, role claim/mutation, assessment/reporting, Parent summaries, curriculum-authority promotion, content-engine mutations, finance, Twin, Pathways, and account recovery.

## Views

Current public inventory reports 21 views, all `security_invoker=true`, and no materialized views. Final certification must still classify every anon/authenticated SELECT grant and verify no sensitive column/data is exposed through a deliberately public view.

## Storage

Current high-risk finding: private `homework-photos` had a legacy permissive staff-read policy alongside the new canonical relationship policy. Repository migration now removes the legacy policy; production remains unchanged until the gated promotion.

Final Storage certification must test:

- Student own folder positive/cross-student negative
- Teacher current assignment positive/unrelated or revoked assignment negative
- School Admin same-school positive/cross-school negative
- Parent visibility only if explicitly intended by product policy
- HQ owner only where explicitly intended
- object listing/path guessing
- signed URL authorization-before-issuance, expiry, and cache/reuse semantics

## Current gates

| Gate | Status | Evidence / next requirement |
|---|---|---|
| Task 3 dependency | **BLOCKED / upstream** | Task 3 must merge before Task 8 final promotion |
| Current branch source contract | IN PROGRESS | expanded with default ACL + Storage regression assertions |
| Production structural RLS | PASS | 553/553 public base tables RLS enabled at current preflight |
| SECURITY DEFINER search path | PASS (structural) | 820/820 currently pinned |
| Public schema CREATE | PASS | anon/authenticated/service_role cannot CREATE in `public` |
| Default privilege least authority | FAIL production / REPAIRED branch | migration staged; runtime upgrade/rebuild proof required |
| Storage relationship authority | FAIL production / REPAIRED branch | legacy permissive homework policy staged for removal; runtime attacks required |
| Views security-invoker | PASS (structural) | 21/21 views; semantic exposure classification still required |
| Full privileged RPC classification | IN PROGRESS | 483 authenticated + 7 anon callable secdefs require classification/attacks |
| Cross-role executable attack matrix | IN PROGRESS | full runtime matrix not yet exact-head certified |
| Clean reconstruction | NOT YET PASS | must run after Task 3 reconciliation on final SHA |
| Existing-state upgrade | NOT YET PASS | must run final security migrations on disposable current-state clone/reconstruction |
| Generated types | NOT YET PASS | rerun after final migration/RPC surface |
| Required CI | NOT YET PASS | exact current head has not reported the full mandatory check set |
| Production apply/postflight | NOT AUTHORIZED YET | only after T3 merge + reconciliation + exact-head green |
| Final merge | WITHHELD | completion contract not satisfied |

## Reconciliation protocol after Task 3 merges

1. Fetch exact-current `main`.
2. Mark all Task 8 evidence touching Student identity/enrollment/relationships invalid.
3. Reconcile canonical `students.id`, `current_student_id()`, provisioning functions, current enrollment, Teacher→Student authority, Parent claim/link changes, conflict/quarantine identity tables, auth/onboarding contracts, generated DB types, and overlapping migrations.
4. Inspect every new/changed RLS policy, grant/revoke, function, view, Storage policy, Edge Function, server route, and service-role path introduced since this branch base.
5. Rebuild from zero using repository migration truth.
6. Prove existing-state upgrade without business-data loss.
7. Regenerate/verify DB types.
8. Run complete direct REST/RPC/Storage and SQL-impersonation cross-role matrix with positive controls.
9. Run Task 1, Task 3, Teacher, Student, Parent, Admin journey/security compatibility suites.
10. Run TypeScript, lint, production build, migration security, repo extraction, and exact-head CI.
11. Re-run production read-only preflight.
12. Only then apply authorized migrations, run postflight/controlled production attacks, update this document with exact evidence, and merge.

## Production preflight fingerprint required at final candidate

Recompute; do not reuse current counts:

- public tables and RLS-disabled count
- anon/authenticated table grants by privilege
- client `TRUNCATE` / `REFERENCES` / `TRIGGER` / `MAINTAIN`
- default ACLs
- public schema CREATE
- SECURITY DEFINER count, owners, EXECUTE roles, search paths
- role-mutation/account-recovery RPCs
- views/materialized views and grants
- Storage buckets/policies
- service-role routes and Edge Functions
- cron/internal endpoints
- current role/membership anomalies

## Merge law

Do not convert queued, skipped, source-only, advisor-only, or branch-green evidence into `PASS`.

Do not merge while any owned P0/P1 remains, Task 3 is unmerged, current-main reconciliation is incomplete, exact-head CI is incomplete, or production postflight is incomplete.

Only after all completion-contract gates are evidenced on one exact SHA may the handover status become:

`TASK 8 — MERGED FOUNDATION / COMPLETE`
