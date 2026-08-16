# VibeSchool Pathways — P0 Baseline, Ownership & Implementation Ledger

**Mission branch:** `agent/pathways-customer-acquisition-strategy`  
**Draft PR:** #168  
**Status:** ACTIVE — ownership audit substantially resolved; bounded P0/P1 implementation underway  
**Started:** 2026-08-16  
**Safety:** no production Supabase migration/application from this branch until promotion is separately authorized and exact-head certification is green.

## Current Status Precedence

For current truth, use: **PR head/workflows → live Supabase → this ledger → execution handoff → older planning docs.**

## Locked Ownership Matrix

| Domain | Classification | Decision |
|---|---|---|
| `students` | REUSE | canonical learner identity; Passport references `students.id` |
| Student Profile | EXTEND | Pathway Passport lives here |
| Student Home | EXTEND LATER | do not create a competing Pathways dashboard |
| personalized learning path | KEEP SEPARATE | mastery/task recommendation, not pathway selection |
| VibeTwin | KEEP SEPARATE | future explainer/coach consumer only |
| formal assessment | KEEP SEPARATE | Quick Check is not a graded assessment |
| global subjects | REUSE | combinations reference canonical subject rows |
| canonical schools | REUSE | offerings reference `schools.id` |
| unmatched school directory | KEEP SEPARATE | discovery evidence, not canonical truth |
| auth/onboarding | REUSE | `get_my_onboarding_state()` dominates continuation |
| sitemap/robots | EXTEND | one crawl/index authority |
| `/learn/careers` | RETIRE AS AUTHORITY / KEEP TEMPORARILY | hard-coded learning launcher, not national career truth |
| Pathways graph | NEW BOUNDED DOMAIN | missing from production baseline |
| anonymous Quick Check | NEW CLIENT-LOCAL CONTRACT | device-local before consent |
| Pathway Passport | NEW LEARNER PROJECTION | persistent learner-owned direction/history |
| public school finder | EXTEND SCHOOL AUTHORITY | canonical schools; verified offerings only |

## Implemented Branch Artifacts

### Public/UX
- `app/pathways/page.tsx`
- `app/pathways/check/page.tsx` + metadata layout
- `app/pathways/continue/page.tsx` + noindex layout
- `app/pathways/schools/page.tsx` + metadata layout
- `lib/pathways/quickCheck.ts`
- `lib/pathways/public.ts`
- `lib/pathways/student.ts`

### Auth continuity
- `app/login/[role]/page.tsx`: safe `next`, actual-role validation, canonical onboarding before continuation.
- `app/signup/student/page.tsx`: same onboarding-dominance rule after account creation.

### Canonical graph migration — branch only
`20260816070000_pathways_canonical_domain.sql`

Creates RLS-governed provenance, pathways, tracks, combinations, combination→canonical-subject links, careers, career links and canonical-school offering evidence. Only three high-level Ministry pathway families are seeded; detailed facts require record-level evidence.

### Learner Passport migration — branch only
`20260816071000_pathways_passport_and_adoption.sql`

Creates append-only decision evidence, current Passport projection, idempotent authenticated adoption and own-passport read RPC.

### Public school-read migration — branch only
`20260816072000_pathways_public_school_read.sql`

Creates bounded anonymous/authenticated canonical-school search. It excludes unmatched directory candidates and only uses verified offering evidence for Pathway/combination filters.

### Learner projection
`app/student/profile/page.tsx` includes **My Pathway Passport**.

### SEO
- sitemap includes `/pathways`, `/pathways/check`, `/pathways/schools`;
- robots allows public Pathways and keeps private workspaces excluded;
- continuation is noindex.

### Mission tests
- `scripts/test-pathways-contract.mjs`
- `.github/workflows/pathways-contract.yml`

Contract covers value-before-auth, no direct Quick Check DB dependency, versioned deterministic scoring, uncertainty, learner-only adoption, canonical learner/school reuse, RLS presence, verified-only public offerings, bounded public search, and crawl/private-route boundaries.

## Important Safeguarding Constraint

Current learner signup is teacher-code + guardian-first. Pathways does not weaken this to improve conversion. Everyone can explore anonymously; current Passport save requires an established canonical learner identity. A standalone family/independent-minor acquisition identity is a separate safeguarding design gate and must not create a second learner identity.

## Certification Evidence So Far

- Supabase Migration Security Contract passed on earlier implementation heads.
- Entry Architecture initially failed because its old static href assertion did not understand safe `?next=` continuation. The test contract was strengthened rather than weakening continuation; the subsequent run passed.
- A dedicated Pathways Mission Contract workflow has now been added.

**Only the final unchanged candidate head counts.** Every time the branch moves, exact-head certification restarts.

Final candidate requirements:
- Pathways Mission Contract PASS;
- Entry Architecture PASS;
- Supabase Migration Security PASS;
- TBL-011 clean rebuild PASS;
- TBL-012 repository extraction PASS;
- TypeScript PASS;
- ESLint PASS;
- Next.js production build PASS;
- privacy/safeguarding/mobile E2E acceptance PASS.

## Remaining Critical Work

1. Stabilize a candidate head and repair exact-head CI failures.
2. Add parent/teacher read-only support projections under existing authority.
3. Audit/implement privacy-safe funnel analytics.
4. Build authoritative track/combination/offering ingestion and reconciliation.
5. Coordinate school population with canonical national school identity work.
6. Add canonical pathway entity pages and career graph/pages.
7. Build bounded Ask VibeSchool only when evidence coverage is sufficient.
8. Run representative mobile/accessibility/low-literacy tests.

## External Dependency

National-scale verified school-offering coverage depends on authoritative Ministry/NEMIS/KNEC source acquisition and canonical-school reconciliation. Missing evidence remains **not yet verified**, never a fabricated negative.

## Promotion Rule

**Do not merge PR #168 to `main` and do not production-apply its migrations until the complete mission is exact-head certified and promotion is explicitly appropriate.**
