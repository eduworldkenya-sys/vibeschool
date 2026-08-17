# Pilot Authority Chain Reconstruction

## Mission

Make the repository capable of reconstructing and semantically certifying the production pilot-authorization boundary from a blank database, without fabricating migration history or creating replay-only migration debt.

The reconstruction is evidence-led: production migration ledger entries, live foreign keys, table grants, RLS policies and stored identity domains are the source of truth. The package contains eight recovered/applied production security versions plus one intentional forward authorization repair.

## Production historical versions

Production already records these versions in `supabase_migrations.schema_migrations`:

1. `20260812082409_close_remaining_rls_cross_tenant_gaps_v2`
2. `20260817131454_pilot_authority_teacher_classes`
3. `20260817131939_pilot_identity_exercise_submissions_authority`
4. `20260817132001_pilot_identity_domain_rls_closure`
5. `20260817145640_pilot_exam_result_authority_scope`
6. `20260817150023_pilot_authority_consequential_audit_lineage`
7. `20260817160156_pilot_pending_admin_authority_quarantine`
8. `20260817160629_pilot_exercise_teacher_class_authority`

`20260812082409` existed in the production ledger but was missing from GitHub. It is restored from production evidence.

## Missing pretracked structures

Blank-database replay proved that production had several objects whose original `CREATE TABLE` migrations were never represented in the repository history:

- `public.meetings`
- `public.class_join_requests`
- `public.exam_results`
- `public.vibelearn_content_views`
- `public.vibelearn_searches`

Early reconstruction iterations used synthetic helper versions. Production-ledger verification proved those versions did not exist remotely and would therefore become future `db push` obligations. They were removed.

Replay prerequisites are instead folded into historical versions production already records as applied, or into the single forward migration with `CREATE ... IF NOT EXISTS` semantics. This preserves blank-rebuild reproducibility without manufacturing production migration debt.

## Forward production repair

`20260818013000_pilot_identity_domain_semantic_repair.sql` is the only intentional new production migration in this package.

It closes four classes of defect discovered during reconstruction.

### 1. Mixed learner identity domains

The column name `student_id` is not one universal identifier in the historical schema. Production foreign keys and stored rows prove:

- `student_exam_readiness_state.student_id -> auth.users(id)`
- `student_mistake_notebook.student_id -> public.profiles(id)`
- `vibelearn_content_views.student_id -> auth.users(id)`
- `vibelearn_searches.student_id -> public.profiles(id)`
- `class_join_requests.student_id -> public.students(id)`
- `exam_results.student_id -> public.students(id)`

`student_kcse_error_classifications.student_id` has no foreign key, but its canonical writer persists authenticated/profile identity. Policies must therefore follow the proven identity domain rather than infer semantics from the column name.

### 2. Exam-result permissive read bypass

Production retained `exam_results_member_read`, which allowed any school member to satisfy a SELECT policy for every result in that school. PostgreSQL permissive RLS policies are OR-combined, so this bypassed narrower assigned-teacher, linked-family and learner read policies.

The forward repair removes that policy. End-user result reads are limited to explicit school-admin, assigned-teacher, linked-family and canonical-learner authorities.

### 3. Legacy anonymous table grants

Production retained blanket anonymous grants on several learner/pilot-sensitive tables. The forward migration removes anonymous table privileges and grants only the authenticated operations required by each surface, with RLS remaining the row-authorization boundary.

### 4. Class-teacher transitional authority

Production has 40 classes with a legacy `classes.teacher_id`, while only 6 currently have an equivalent `teacher_classes.is_class_teacher` assignment. Replacing the join-request teacher policy immediately would lock legitimate teachers out of 34 classes.

The repair therefore retains the legacy class-teacher predicate temporarily and additionally requires authoritative school membership. Migration to the canonical `teacher_classes` representation must be done by a separately certified assignment reconciliation/backfill, not by silently changing live authority semantics.

## Semantic certification

The certification suite proves behavior rather than policy names alone.

- `scripts/sql/pilot_authority_chain_verify.sql`
  - recovered pilot migration presence;
  - real `student_id` foreign-key domains;
  - teacher-class assignment authority;
  - learner submission identity and current enrollment;
  - learner/family/teacher/admin scopes;
  - complete exam-result consequential scope;
  - audit trigger/function hardening;
  - administrator authority quarantine.
- `scripts/sql/pilot_authority_bypass_verify.sql`
  - no synthetic replay-helper versions;
  - the forward migration is present;
  - no anonymous grants on `class_join_requests` or `exam_results`;
  - no PUBLIC-role pilot policies;
  - no `exam_results_member_read` bypass;
  - class-join and exam-result actor scopes remain explicit.
- `scripts/sql/recovered_cross_tenant_security_verify.sql`
  - recovered `20260812082409` is present;
  - direct school-membership INSERT remains closed;
  - teacher mastery visibility requires current learner enrollment plus teacher assignment;
  - meetings remain creator/member/admin scoped and anonymous-inaccessible.
- TBL-011 clean-rebuild verification checks the reconstructed final authorization state rather than rejecting hardened policies solely by historical policy name.

## Promotion gate

Do not merge until the exact branch head has been reconciled onto the latest canonical `main` and passes:

1. Supabase Migration Security Contract;
2. Pilot Authority Chain Certification;
3. TBL-011 Isolated Clean Rebuild;
4. Auth Gateway Contract;
5. Auth & Onboarding Hardening;
6. repository extraction;
7. TypeScript compilation and production build.

After merge, apply only `20260818013000_pilot_identity_domain_semantic_repair.sql` to production. Do not re-apply historical versions or manually mark synthetic migration history. Then run read-only production semantic verification and compare sensitive-table row counts before/after the forward migration.
