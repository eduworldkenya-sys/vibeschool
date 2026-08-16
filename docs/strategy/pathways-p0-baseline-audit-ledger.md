# VibeSchool Pathways — Live P0 Implementation Ledger

**Branch:** `agent/pathways-customer-acquisition-strategy` · **Draft PR:** #168  
**Status:** ACTIVE. **No production migration and no merge until complete exact-head certification.**

## Current-truth precedence

**PR head/workflows → live Supabase → this ledger → execution handoff → older planning docs.**

## Locked ownership

- **Learner:** reuse `students.id`; no duplicate Pathways learner identity.
- **Profile:** extend canonical Student Profile with Pathway Passport.
- **Home:** preserve current learning next-action authority; no second dashboard.
- **Learning recommender:** separate mastery/task domain, not pathway selector.
- **Twin:** future explainer/coach consumer only, not Pathways truth.
- **Assessment:** formal assessment stays separate from Quick Check.
- **Subjects:** reuse canonical global subjects.
- **Schools:** reuse canonical `schools`; unmatched directory stays discovery evidence.
- **Auth/onboarding:** reuse `get_my_onboarding_state()`; continuation never bypasses it.
- **SEO:** extend existing sitemap/robots.
- **Careers:** `/learn/careers` is temporary non-authoritative learning navigation.
- **New domain:** only missing Pathways provenance/graph/decision/Passport concepts are added.

## Implemented on branch

### Public product
- `/pathways` — free public decision home.
- `/pathways/check` — six-question deterministic `pathways-quick-v1`, local-before-consent, honest ambiguity.
- `/pathways/continue` — explicit Save bridge; `noindex`.
- `/pathways/schools` — canonical public school finder; verified-only offering filters.

### Auth/identity
- role login + learner signup support safe `next` only after canonical onboarding is `ready`.
- non-student account cannot overwrite learner Pathway Passport.
- existing guardian-first/teacher-code learner signup is not weakened.

### Migrations — branch only
1. `20260816070000_pathways_canonical_domain.sql`  
   provenance, pathways, tracks, combinations, combination→canonical subjects, careers, career links, canonical-school offering evidence; RLS + explicit public/service privileges.
2. `20260816071000_pathways_passport_and_adoption.sql`  
   append-only learner decisions, current Passport, idempotent authenticated adoption, own-passport read.
3. `20260816072000_pathways_public_school_read.sql`  
   bounded anonymous canonical-school search; excludes unmatched directory candidates; pathway/combination filters require verified offering evidence.

### Learner projection
- `app/student/profile/page.tsx` contains **My Pathway Passport**.

### SEO
- sitemap: `/pathways`, `/pathways/check`, `/pathways/schools`.
- robots: public Pathways allowed; private workspaces excluded.
- continuation: noindex.

### Mission acceptance
- `scripts/test-pathways-contract.mjs`
- `.github/workflows/pathways-contract.yml`

The Pathways contract checks free-before-auth, no direct Quick Check DB dependency, local-before-consent, versioned deterministic scoring, uncertainty, learner-only adoption, canonical learner/school reuse, RLS, verified-only offering filtering, bounded public search and public/private crawl boundaries.

## Safeguarding constraint

A completely new anonymous visitor can always use Pathways for free. Current Passport Save requires an established canonical learner identity. A future standalone family/independent-minor account model is a separate safeguarding design gate; do not bypass guardian requirements or create `pathway_users` for conversion.

## Certification rule

Earlier migration-security and Entry Architecture passes are diagnostic evidence only once the head moves. **Final certification must be on one unchanged head.**

Require:
- Pathways Mission Contract PASS
- Entry Architecture PASS
- Migration Security PASS
- TBL-011 clean rebuild PASS
- TBL-012 repository extraction PASS
- TypeScript PASS
- ESLint PASS
- Next.js production build PASS
- privacy/safeguarding/mobile acceptance PASS

## Remaining critical work

1. Stabilize/fix exact-head CI.
2. Parent/teacher read-only support projections.
3. Privacy-safe funnel analytics.
4. Authoritative track/combination/school-offering ingestion and reconciliation.
5. Canonical pathway entity and career pages.
6. Bounded Ask VibeSchool after sufficient evidence coverage.
7. Representative mobile/accessibility/low-literacy acceptance.

## External dependency

National verified school-offering coverage depends on authoritative Ministry/NEMIS/KNEC evidence and canonical-school reconciliation. Missing evidence means **not yet verified**, never an invented negative.

## Promotion

**Do not merge PR #168 and do not production-apply its migrations until the complete mission is exact-head certified and promotion is appropriate.**
