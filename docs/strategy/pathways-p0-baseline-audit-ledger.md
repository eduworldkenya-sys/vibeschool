# VibeSchool Pathways — P0 Baseline, Ownership & Implementation Ledger

**Mission branch:** `agent/pathways-customer-acquisition-strategy`  
**Status:** ACTIVE — P0 ownership audit substantially resolved; bounded implementation underway  
**Started:** 2026-08-16  
**Safety:** no production Supabase migration/application from this branch until promotion is separately authorized and exact-head certification is green.

## Objective

Build Pathways by extending canonical VibeSchool systems rather than duplicating learner identity, school identity, assessment, Twin, auth/onboarding or SEO authority.

## Locked Ownership Matrix

| Domain | Classification | Decision |
|---|---|---|
| `students` identity | REUSE | all learner-owned Pathways persistence references `students.id` |
| Student Profile | EXTEND | Pathway Passport is projected into existing learner profile |
| Student Home | EXTEND LATER | current next-action OS remains authoritative; Pathways may add a projection, not a second dashboard |
| personalized learning path | KEEP SEPARATE | mastery/task recommendation engine is not a future-pathway selector |
| VibeTwin | KEEP SEPARATE | explainer/coach consumer only; not Pathways truth authority |
| formal assessment engine | KEEP SEPARATE / REUSE PATTERNS | Quick Check is not a graded classroom assessment |
| global subjects | REUSE | Pathways combinations reference canonical global `subjects` rows |
| canonical schools | REUSE | offerings reference `schools.id` |
| unmatched school directory | KEEP SEPARATE | discovery evidence must not be presented as canonical identity |
| auth/onboarding | REUSE | `get_my_onboarding_state()` stays authoritative |
| sitemap/robots | EXTEND | existing Next.js authorities own Pathways crawl/index policy |
| `/learn/careers` hard-coded launcher | RETIRE AS AUTHORITY / KEEP TEMPORARILY | do not grow it into national career truth |
| Pathway/career/combination graph | NEW BOUNDED DOMAIN | absent from production baseline; additive graph created on branch |
| anonymous Quick Check state | NEW CLIENT-LOCAL CONTRACT | remains on-device until user explicitly chooses Save |
| Pathway Passport | NEW LEARNER PROJECTION | canonical learner-owned persistent direction/history |
| public school finder | EXTEND SCHOOL AUTHORITY | active canonical schools only; offering filters require verified evidence |

## Evidence-backed findings

### Learner identity
Live production uses `public.students` as the canonical learner identity and student RPCs resolve `students.profile_id = auth.uid()`. A Pathways learner identity is forbidden.

### Subject authority
Production contains canonical global subject rows in `public.subjects` with `school_id is null`. Pathways subject-combination edges therefore reference those rows rather than creating a second national subject catalogue.

### Existing learning recommendation semantics
`student_refresh_personalized_path()` derives learning actions from mastery, curriculum outcomes, interventions and task urgency. It is intentionally not reused as career/pathway recommendation logic.

### Twin boundary
`student_get_twin_brain()` remains the broad bounded learning/tutor brain. Pathways will later expose a read projection for explanation; Twin cannot independently decide official pathway eligibility or school offerings.

### School identity
The national school identity/search stack is canonical. The existing `search_school_directory()` can mix active canonical identities with unmatched directory candidates and is authenticated-only; that behavior is inappropriate as a public pathway-offering truth endpoint.

### Auth continuation
The OAuth callback already implements the required safety invariant: a validated `next` path can win only when `get_my_onboarding_state()` reports `ready`. Password login and learner signup on this branch now use the same invariant. Pathways continuation cannot bypass teacher/parent/learner onboarding.

### New visitor account constraint
The existing learner-account flow is intentionally school/guardian connected: learner signup uses a teacher-issued code and guardian-first activation. Pathways does not weaken that safety rule. Anonymous users may receive and keep free guidance without an account. Saving into the canonical learner Pathway Passport currently requires an established learner identity. A future standalone-family acquisition model must be designed as a separate safeguarding/identity gate rather than silently creating unsupervised minor identities.

## Implemented branch artifacts

### Public acquisition namespace
- `app/pathways/page.tsx`
- canonical `https://www.vibeschool.co.ke/pathways`
- action-first entry points
- free/no-login-first promise
- high-level pathway-family explanations

### Quick Check
- `lib/pathways/quickCheck.ts`
- `app/pathways/check/page.tsx`
- `app/pathways/check/layout.tsx`
- six short interest prompts
- deterministic versioned scoring (`pathways-quick-v1`)
- honest close/tie behavior
- no fake numerical match percentages
- local-device persistence
- no database write before explicit Save

### Continuation
- `app/pathways/continue/page.tsx`
- `app/pathways/continue/layout.tsx` with `noindex`
- `app/login/[role]/page.tsx` safe `next` support
- `app/signup/student/page.tsx` safe `next` support
- canonical onboarding remains dominant
- non-student accounts cannot overwrite learner Pathway Passport

### Canonical knowledge graph migration
`supabase/migrations/20260816070000_pathways_canonical_domain.sql`

Creates additive, RLS-governed:
- `pathway_sources`
- `pathways`
- `pathway_tracks`
- `pathway_subject_combinations`
- `pathway_combination_subjects`
- `pathway_careers`
- `pathway_career_links`
- `pathway_school_offerings`

The migration references existing `subjects` and `schools`. Only the three high-level Ministry pathway families are seeded. Detailed tracks/combinations/offerings remain absent until record-level source evidence is ingested.

### Learner persistence migration
`supabase/migrations/20260816071000_pathways_passport_and_adoption.sql`

Creates:
- append-only `student_pathway_decisions` evidence/history;
- `student_pathway_passports` current learner projection;
- idempotent authenticated `student_adopt_pathway_quick_check(...)`;
- learner-owned `student_get_pathway_passport()`.

### Public school-read contract
`supabase/migrations/20260816072000_pathways_public_school_read.sql`

Creates `pathways_search_public_schools(...)`:
- anon/authenticated read-only execution;
- active canonical `schools` only;
- no unmatched directory candidates;
- no membership/contact/private fields;
- pathway/combination filtering requires `pathway_school_offerings.offering_status='verified'` and `verified_at` evidence.

UI/service:
- `lib/pathways/public.ts`
- `app/pathways/schools/page.tsx`
- `app/pathways/schools/layout.tsx`

### Learner projection
- `lib/pathways/student.ts`
- `app/student/profile/page.tsx` now includes **My Pathway Passport**.

### SEO/index authority
- `app/sitemap.ts` includes `/pathways`, `/pathways/check`, `/pathways/schools`.
- `app/robots.ts` explicitly allows public Pathways while private account/workspace routes remain disallowed.
- `/pathways/continue` is explicitly noindex.

## Security and architecture certification evidence

Repository migration contract requires every new public table to declare:
- RLS;
- explicit privileges;
- policy/service-only classification;
- authorization-test marker;
- no blanket anon/authenticated `GRANT ALL`.

The first exact-head migration-security workflow for the new domain passed. The initial Entry Architecture run exposed a regression-test assumption that direct signup hrefs were static; the implementation correctly preserves `next`, and the regression contract was strengthened to assert both direct signup availability and continuation's onboarding dominance. The subsequent Entry Architecture run passed.

## Remaining P0/P1 critical work

1. Complete exact-head clean rebuild, repository extraction, TypeScript, ESLint and production-build certification on the latest head.
2. Add dedicated Pathways contract tests for deterministic scoring, local-before-consent behavior, learner-only adoption and public-school filtering.
3. Add parent/teacher read-only support projections using existing relationship/class authority; no adoption/mutation rights.
4. Add Student Home Pathways projection only if it does not displace the current learning next-action authority.
5. Finish analytics writer/privacy contract.
6. Build authoritative ingestion/reconciliation for tracks, subject combinations and school offerings.
7. Coordinate school-offering population with the national school-identity mission; do not fabricate or bulk-promote directory records.
8. Replace/canonicalize legacy `/learn/careers` only after career source/progression data exists.
9. Build bounded Ask VibeSchool only after the canonical graph is sufficiently populated.
10. Run representative mobile/accessibility/low-literacy E2E checks.

## Current Blocker Outside Pathways Code

National-scale school-offering coverage depends on authoritative Ministry/NEMIS/KNEC source acquisition and canonical-school reconciliation. The Pathways architecture is prepared to ingest verified offerings, but absence of a verified record must remain “not yet verified” rather than being converted into a false negative or invented fact.

## Promotion Rule

**Do not merge PR #168 to `main` until the complete agreed Pathways mission is implemented and exact-head certified.**

Documentation completion, individual green workflows, or a working Quick Check are not sufficient promotion evidence.
